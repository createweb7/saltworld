// LIVE booking tests — these create real bookings on the site under test,
// then cancel every one of them through the admin API at the end.
//
// Only runs with LIVE_TESTS=1 and these set:
//   TEST_PHONE, TEST_PHONE_2   two phones you own (confirmation messages go there)
//   ADMIN_EMAIL, ADMIN_PASSWORD  an admin login, used to cancel / reschedule
//   TEST_EMAIL (optional)        where confirmation emails go
// Bookings use pay-at-visit (no Razorpay) on dates 30+ days out, so they
// don't touch payments and are unlikely to clash with real customers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, istDate, istIso, istHHmm, minutesBetween, slotTimes, RULES } from './support/helpers.mjs';

const ENV = process.env;
const ENABLED = ENV.LIVE_TESTS === '1';
const MISSING = ['TEST_PHONE', 'TEST_PHONE_2', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'].filter((k) => !ENV[k]);
const skip = !ENABLED ? 'set LIVE_TESTS=1 to run live booking tests'
  : MISSING.length ? `missing ${MISSING.join(', ')}` : false;

// One date per test, 30+ days out: the same test phone booking two things on
// one day would trip the "you already have a booking then" check and mask
// what the test is actually checking.
const DAY = {
  combo: istDate(30), capacity: istDate(31), room: istDate(32), own: istDate(33),
  rules: istDate(34), reschedule: istDate(35), cancel: istDate(36), salt: istDate(37),
};
const created = [];
let adminCookie = null;

function contact(phone, n = 1) {
  return { name: `Automated Test ${n}`, phone, email: ENV.TEST_EMAIL || '' };
}

async function book({ therapies, startIso, plan = null, phone, n, sessionMode = 'single', floatMin = null, guests = 1 }) {
  const r = await api('/api/bookings', {
    method: 'POST',
    body: {
      therapies: therapies.map((slug) => ({ slug, durationMin: slug === 'float-therapy' ? floatMin : undefined })),
      sessionMode, floatDurationMin: floatMin, startAt: startIso, plan,
      contact: contact(phone, n), payment: 'at-visit', guests,
      outcomeLabel: 'Automated test',
    },
  });
  if (r.status === 200 && r.json?.id) created.push(r.json.id);
  return r;
}

async function admin(path, body) {
  return api(`/api/admin${path}`, { method: 'POST', body: body || {}, cookie: adminCookie });
}

async function freeTimes(slug, date) {
  const r = await api(`/api/scheduling/therapy-slots?therapy=${slug}&date=${date}`);
  return slotTimes(r.json).map((s) => s.time);
}

const plus = (hhmm, min) => istHHmm(new Date(istIso('2000-01-01', hhmm)).getTime() + min * 60000);

before(async () => {
  if (skip) return;
  const r = await api('/api/admin/auth/login', { method: 'POST', body: { email: ENV.ADMIN_EMAIL, password: ENV.ADMIN_PASSWORD } });
  assert.equal(r.status, 200, 'admin login failed');
  const c = (r.headers.getSetCookie?.() || []).find((x) => x.startsWith('sw_admin='));
  assert.ok(c, 'no admin session cookie');
  adminCookie = c.split(';')[0];
});

after(async () => {
  if (skip || !adminCookie) return;
  const failed = [];
  for (const id of created) {
    const r = await admin(`/bookings/${id}/cancel`);
    if (r.status !== 200 || r.json?.status !== 'cancelled') failed.push(id);
  }
  if (failed.length) console.error(`!! Could not cancel test bookings: ${failed.join(', ')} — cancel them in Admin.`);
  else console.log(`Cancelled all ${created.length} test bookings.`);
});

test('combo booking — Solo Salt + Sauna + Float 60: price, gaps, confirmed', { skip }, async () => {
  const s = await api(`/api/scheduling/slots?therapies=salt-therapy,infrared-sauna,float-therapy&date=${DAY.combo}&sessionMode=single&floatDurationMin=60`);
  const slot = slotTimes(s.json)[0];
  assert.ok(slot, 'no time offered');
  const r = await book({ therapies: ['salt-therapy', 'infrared-sauna', 'float-therapy'], startIso: slot.startIso, plan: slot.plan, phone: ENV.TEST_PHONE, floatMin: 60 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.total, 6000);
  assert.equal(r.json.status, 'confirmed');
  const plan = r.json.schedule;
  assert.equal(plan.length, 3);
  for (let k = 1; k < plan.length; k++) {
    assert.ok(minutesBetween(plan[k - 1].to, plan[k].from) >= RULES.guestWaitAfter[plan[k - 1].therapySlug]);
  }
});

test('room conflicts — Sauna: second booking at the same time is refused, free again after 30 min gap', { skip }, async () => {
  const free = await freeTimes('infrared-sauna', DAY.room);
  const T = free.find((t) => free.includes(plus(t, 60)) && t >= '11:00' && t <= '17:00');
  assert.ok(T, 'no free Sauna time with an hour after it');
  const a = await book({ therapies: ['infrared-sauna'], startIso: istIso(DAY.room, T), phone: ENV.TEST_PHONE_2, n: 2 });
  assert.equal(a.status, 200, JSON.stringify(a.json));

  const same = await book({ therapies: ['infrared-sauna'], startIso: istIso(DAY.room, T), phone: ENV.TEST_PHONE, n: 1 });
  assert.equal(same.status, 409, 'same time should be refused');
  assert.equal(same.json.error, 'slot_unavailable');
  assert.ok(Array.isArray(same.json.suggestions), 'should suggest other times');

  const during = await book({ therapies: ['infrared-sauna'], startIso: istIso(DAY.room, plus(T, 45)), phone: ENV.TEST_PHONE, n: 1 });
  assert.equal(during.status, 409, '45 min later is inside session + 30 min room gap');

  const afterGap = await book({ therapies: ['infrared-sauna'], startIso: istIso(DAY.room, plus(T, 60)), phone: ENV.TEST_PHONE, n: 1 });
  assert.equal(afterGap.status, 200, `free again at ${plus(T, 60)}: ${JSON.stringify(afterGap.json)}`);
});

test('own bookings — same phone, overlapping therapy is refused', { skip }, async () => {
  const free = await freeTimes('red-light-therapy', DAY.own);
  const T = free.find((t) => t >= '17:00' && t <= '19:00');
  assert.ok(T, 'no free Red Light time');
  const a = await book({ therapies: ['red-light-therapy'], startIso: istIso(DAY.own, T), phone: ENV.TEST_PHONE_2, n: 2 });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  const clash = await book({ therapies: ['cold-plunge'], startIso: istIso(DAY.own, plus(T, 15)), phone: ENV.TEST_PHONE_2, n: 2 });
  assert.equal(clash.status, 400);
  assert.equal(clash.json.error, 'cross_service_buffer');
});

test('rules — past time and after 21:00 are refused', { skip }, async () => {
  const past = await book({ therapies: ['salt-therapy'], startIso: istIso(istDate(-1), '10:00'), phone: ENV.TEST_PHONE });
  assert.equal(past.status, 400);
  assert.equal(past.json.error, 'slot_in_past');
  const late = await book({ therapies: ['salt-therapy'], startIso: istIso(DAY.rules, '21:15'), phone: ENV.TEST_PHONE });
  assert.equal(late.status, 400);
  assert.equal(late.json.error, 'after_last_slot');
});

test('admin — reschedule moves the booking and frees the old time', { skip }, async () => {
  const free = await freeTimes('cold-plunge', DAY.reschedule);
  const T = free.find((t) => t >= '08:30' && t <= '10:00');
  const T2 = free.find((t) => t >= '19:00' && t <= '20:00');
  assert.ok(T && T2, 'no free Cold Plunge times');
  const a = await book({ therapies: ['cold-plunge'], startIso: istIso(DAY.reschedule, T), phone: ENV.TEST_PHONE, n: 1 });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.ok(!(await freeTimes('cold-plunge', DAY.reschedule)).includes(T), 'old time still offered after booking');

  const r = await admin(`/bookings/${a.json.id}/reschedule`, { startAt: istIso(DAY.reschedule, T2), slotDate: DAY.reschedule, slotTime: T2 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const now = await freeTimes('cold-plunge', DAY.reschedule);
  assert.ok(now.includes(T), 'old time not freed');
  assert.ok(!now.includes(T2), 'new time still offered');
});

test('admin — cancel frees the time again', { skip }, async () => {
  const free = await freeTimes('red-light-therapy', DAY.cancel);
  const T = free.find((t) => t >= '08:00' && t <= '09:30');
  assert.ok(T, 'no free Red Light morning time');
  const a = await book({ therapies: ['red-light-therapy'], startIso: istIso(DAY.cancel, T), phone: ENV.TEST_PHONE, n: 1 });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  const c = await admin(`/bookings/${a.json.id}/cancel`);
  assert.equal(c.status, 200);
  assert.equal(c.json.status, 'cancelled');
  assert.ok((await freeTimes('red-light-therapy', DAY.cancel)).includes(T), 'time not freed after cancel');
});

test('Float — two tanks at the same time, a third is refused', { skip }, async (t) => {
  const free = await freeTimes('float-therapy', DAY.capacity);
  const X = ['20:30', '18:00', '15:30'].find((x) => free.includes(x));
  assert.ok(X, 'no free Float time');
  const one = await book({ therapies: ['float-therapy'], startIso: istIso(DAY.capacity, X), phone: ENV.TEST_PHONE, n: 1, floatMin: 60 });
  assert.equal(one.status, 200, JSON.stringify(one.json));
  const two = await book({ therapies: ['float-therapy'], startIso: istIso(DAY.capacity, X), phone: ENV.TEST_PHONE_2, n: 2, floatMin: 60 });
  if (two.status === 409) return t.skip(`a real booking already holds the other tank at ${X}`);
  assert.equal(two.status, 200, JSON.stringify(two.json));
  const three = await book({ therapies: ['float-therapy'], startIso: istIso(DAY.capacity, X), phone: ENV.TEST_PHONE, n: 1, floatMin: 60 });
  assert.equal(three.status, 409, 'third Float at the same time should be refused');
});

test('Salt Cave — 7 people fills the slot, the 8th is refused', { skip }, async (t) => {
  const free = await freeTimes('salt-therapy', DAY.salt);
  const S = free.find((x) => x >= '11:00' && x <= '13:00');
  assert.ok(S, 'no free Salt time');
  const full = await book({ therapies: ['salt-therapy'], startIso: istIso(DAY.salt, S), phone: ENV.TEST_PHONE, n: 1, guests: 7 });
  if (full.status === 409) return t.skip(`real guests already booked at ${S}`);
  assert.equal(full.status, 200, JSON.stringify(full.json));
  assert.equal(full.json.total, 8400);
  const eighth = await book({ therapies: ['salt-therapy'], startIso: istIso(DAY.salt, S), phone: ENV.TEST_PHONE_2, n: 2 });
  assert.equal(eighth.status, 409);
});
