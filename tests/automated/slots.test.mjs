// Times the site offers, checked against the rules doc. Read-only — only
// calls the slot / recommendation endpoints, never books anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, istDate, istHHmm, minutesBetween, slotTimes, RULES } from './support/helpers.mjs';

// Two weeks out: far enough that same-day cutoffs and lead times don't apply.
const DATE = istDate(14);
const THERAPIES = ['salt-therapy', 'float-therapy', 'infrared-sauna', 'cold-plunge', 'red-light-therapy'];

async function therapySlots(slug) {
  const r = await api(`/api/scheduling/therapy-slots?therapy=${slug}&date=${DATE}`);
  assert.equal(r.status, 200);
  return slotTimes(r.json);
}

test('saved booking rules match the rules doc', async () => {
  const r = await api('/api/booking-rules');
  assert.equal(r.status, 200);
  for (const [slug, min] of Object.entries(RULES.leadMin)) {
    assert.equal(r.json.perTherapyLeadMin[slug], min, `minimum notice for ${slug}`);
  }
  assert.equal(r.json.lastStartTime, RULES.lastSlot);
  assert.deepEqual(r.json.sameDayLateCutoff, { afterTime: '19:00', slotsAfter: '20:00' });
});

test('therapy settings — room gaps match the rules doc', async () => {
  const r = await api('/api/therapies');
  assert.equal(r.status, 200);
  for (const [slug, gap] of Object.entries(RULES.roomGapAfter)) {
    const t = r.json.find((x) => x.slug === slug);
    assert.ok(t, `${slug} missing`);
    assert.equal((t.postBufferMin || 0) + (t.cleaningBufferMin || 0), gap, `room gap for ${slug}`);
    assert.equal(t.postBufferMin, RULES.guestWaitAfter[slug], `guest wait for ${slug}`);
  }
});

test('Float is only offered at its 6 fixed times', async () => {
  const times = (await therapySlots('float-therapy')).map((s) => s.time);
  assert.ok(times.length > 0, 'no Float times offered');
  for (const t of times) assert.ok(RULES.floatTimes.includes(t), `Float offered at ${t}`);
  assert.equal(new Set(times).size, times.length, 'duplicate Float times');
});

for (const slug of THERAPIES) {
  test(`${slug} — first slot 08:00 or later, last slot no later than 21:00`, async () => {
    const times = (await therapySlots(slug)).map((s) => s.time);
    assert.ok(times.length > 0, 'nothing offered');
    assert.ok(times[0] >= RULES.firstSlot, `first slot ${times[0]}`);
    assert.ok(times.at(-1) <= RULES.lastSlot, `last slot ${times.at(-1)}`);
  });

  test(`${slug} — label matches the time it actually books`, async () => {
    for (const s of await therapySlots(slug)) {
      assert.equal(istHHmm(s.plan[0].from), s.time, `shown ${s.time}, books ${istHHmm(s.plan[0].from)}`);
    }
  });
}

// Every pair, both orders the engine picks: the guest's wait between two
// therapies must be at least the wait after the first one. Except Sauna +
// Cold Plunge — that is Hot & Cold Contrast Option 2 (rules doc §6): Sauna
// first, then straight into the Cold Plunge.
const CONTRAST_PAIR = 'infrared-sauna + cold-plunge';
const PAIRS = [];
for (let i = 0; i < THERAPIES.length; i++) for (let j = i + 1; j < THERAPIES.length; j++) PAIRS.push([THERAPIES[i], THERAPIES[j]]);

for (const pair of PAIRS) {
  test(`gaps inside one booking — ${pair.join(' + ')}`, async () => {
    const r = await api(`/api/scheduling/slots?therapies=${pair.join(',')}&date=${DATE}&sessionMode=single&floatDurationMin=60`);
    assert.equal(r.status, 200);
    const slots = slotTimes(r.json);
    assert.ok(slots.length > 0, 'nothing offered');
    for (const s of slots) {
      if (pair.join(' + ') === CONTRAST_PAIR) {
        assert.deepEqual(s.plan.map((p) => p.therapySlug), ['infrared-sauna', 'cold-plunge'], `${s.time}: Sauna first`);
        assert.equal(minutesBetween(s.plan[0].to, s.plan[1].from), 0, `${s.time}: Cold Plunge straight after the Sauna`);
        continue;
      }
      for (let k = 1; k < s.plan.length; k++) {
        const prev = s.plan[k - 1], cur = s.plan[k];
        const gap = minutesBetween(prev.to, cur.from);
        assert.ok(gap >= RULES.guestWaitAfter[prev.therapySlug],
          `${s.time}: ${prev.therapySlug} ends ${istHHmm(prev.to)}, ${cur.therapySlug} starts ${istHHmm(cur.from)} (${gap} min)`);
        if (cur.therapySlug === 'float-therapy') assert.ok(RULES.floatTimes.includes(istHHmm(cur.from)), `Float at ${istHHmm(cur.from)}`);
      }
      for (const p of s.plan) assert.ok(istHHmm(p.from) <= RULES.lastSlot, `${p.therapySlug} starts ${istHHmm(p.from)}`);
    }
  });
}

test('suggested times — 3 genuinely different options', async () => {
  const r = await api(`/api/scheduling/recommendations?therapies=salt-therapy,infrared-sauna,float-therapy&date=${DATE}&preferred=10:30&sessionMode=single&floatDurationMin=60`);
  assert.equal(r.status, 200);
  const recs = r.json.recommendations;
  assert.equal(recs.length, 3);
  const keys = recs.map((x) => x.startIso + x.orderKey);
  assert.equal(new Set(keys).size, 3, 'duplicate suggestions');
  for (const x of recs) assert.equal(istHHmm(x.plan[0].from), x.time, 'headline time differs from first therapy');
});

// Hot & Cold Contrast inside bigger packages (rules doc §6).
test('Separate Sessions in a package — Cold Plunge always straight after the Sauna', async () => {
  const r = await api(`/api/scheduling/slots?therapies=salt-therapy,cold-plunge,red-light-therapy,infrared-sauna&date=${DATE}&sessionMode=single`);
  assert.equal(r.status, 200);
  const slots = slotTimes(r.json);
  assert.ok(slots.length > 0, 'nothing offered');
  for (const s of slots) {
    const order = s.plan.map((p) => p.therapySlug);
    const i = order.indexOf('infrared-sauna');
    assert.equal(order[i + 1], 'cold-plunge', `${s.time}: ${order.join(' > ')}`);
    assert.equal(minutesBetween(s.plan[i].to, s.plan[i + 1].from), 0, `${s.time}: no wait before the plunge`);
  }
});

test('Contrast Experience in a package — one 60 min step holding both rooms', async () => {
  const r = await api(`/api/scheduling/slots?therapies=salt-therapy,hot-cold-contrast,float-therapy&date=${DATE}&sessionMode=single&floatDurationMin=60`);
  assert.equal(r.status, 200);
  const slots = slotTimes(r.json);
  assert.ok(slots.length > 0, 'nothing offered');
  for (const s of slots) {
    const step = s.plan.find((p) => p.therapySlug === 'hot-cold-contrast');
    assert.ok(step, `${s.time}: no contrast step`);
    assert.equal(minutesBetween(step.from, step.to), 60);
    assert.ok(!s.plan.some((p) => p.therapySlug === 'infrared-sauna' || p.therapySlug === 'cold-plunge'));
  }
});
