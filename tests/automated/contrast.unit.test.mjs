// Hot & Cold Contrast (rules doc §6), tested offline against made-up room
// bookings — no database.
//   Option 1 'alternate': the hot-cold-contrast therapy holds BOTH the Sauna
//            room and the Cold Plunge pool for 60 min.
//   Option 2 'sequence':  Sauna 30 min, then straight into Cold Plunge 30 min.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isContrastPair, hasContrastPair, contrastBookingSlugs } from '../../lib/contrast.js';
import { resolveComboPrice } from '../../lib/combo-pricing.js';
import { buildJourneyPlan, checkJourneyAvailability } from '../../lib/scheduling.js';

const SAUNA = { slug: 'infrared-sauna', name: 'Infrared Sauna', durationMin: 30, postBufferMin: 30, cleaningBufferMin: 0, resourceIds: ['sauna'] };
const COLD = { slug: 'cold-plunge', name: 'Cold Plunge', durationMin: 30, postBufferMin: 30, cleaningBufferMin: 0, resourceIds: ['cold'] };
const SALT = { slug: 'salt-therapy', name: 'Salt Therapy', durationMin: 60, postBufferMin: 15, cleaningBufferMin: 5, resourceIds: ['cave'] };
const CONTRAST = { slug: 'hot-cold-contrast', name: 'Hot & Cold Contrast', durationMin: 60, postBufferMin: 30, cleaningBufferMin: 15, concurrentResources: true, resourceIds: ['sauna', 'cold'] };

test('contrast — the two options apply whenever Sauna and Cold Plunge are both booked', () => {
  assert.equal(isContrastPair(['infrared-sauna', 'cold-plunge']), true);
  assert.equal(hasContrastPair(['cold-plunge', 'salt-therapy', 'infrared-sauna']), true);
  assert.equal(hasContrastPair(['infrared-sauna', 'salt-therapy']), false);
  assert.deepEqual(contrastBookingSlugs(['cold-plunge', 'infrared-sauna'], 'alternate'), ['hot-cold-contrast']);
  assert.deepEqual(contrastBookingSlugs(['cold-plunge', 'infrared-sauna'], 'sequence'), ['infrared-sauna', 'cold-plunge']);
  assert.deepEqual(contrastBookingSlugs(['salt-therapy', 'cold-plunge'], 'alternate'), ['salt-therapy', 'cold-plunge']);
  // Bigger packages: the pair goes where the first of the two was, rest keep their order.
  assert.deepEqual(contrastBookingSlugs(['salt-therapy', 'cold-plunge', 'red-light-therapy', 'infrared-sauna', 'float-therapy'], 'alternate'),
    ['salt-therapy', 'hot-cold-contrast', 'red-light-therapy', 'float-therapy']);
  assert.deepEqual(contrastBookingSlugs(['salt-therapy', 'cold-plunge', 'red-light-therapy', 'infrared-sauna'], 'sequence'),
    ['salt-therapy', 'infrared-sauna', 'cold-plunge', 'red-light-therapy']);
});

test('contrast — Contrast Experience costs the same as the Sauna + Cold Plunge combo it replaces', () => {
  for (const mode of ['single', 'couple']) {
    assert.equal(resolveComboPrice({ slugs: ['salt-therapy', 'hot-cold-contrast'], sessionMode: mode }),
      resolveComboPrice({ slugs: ['salt-therapy', 'infrared-sauna', 'cold-plunge'], sessionMode: mode }));
    assert.equal(resolveComboPrice({ slugs: ['salt-therapy', 'hot-cold-contrast', 'red-light-therapy', 'float-therapy'], sessionMode: mode, floatDurationMin: 90 }),
      resolveComboPrice({ slugs: ['salt-therapy', 'infrared-sauna', 'cold-plunge', 'red-light-therapy', 'float-therapy'], sessionMode: mode, floatDurationMin: 90 }));
  }
});

const START = new Date('2027-01-20T04:30:00.000Z'); // 10:00 IST
const min = (a, b) => (new Date(b) - new Date(a)) / 60000;

test('Option 2 — Cold Plunge starts as soon as the Sauna ends', () => {
  const j = buildJourneyPlan(START, [SAUNA, COLD]);
  assert.equal(min(j.plan[0].to, j.plan[1].from), 0);
  assert.equal(j.totalVisitMin, 60);
});

test('Option 2 inside a bigger journey — Cold Plunge still straight after the Sauna', () => {
  const j = buildJourneyPlan(START, [SALT, SAUNA, COLD]);
  assert.equal(min(j.plan[0].to, j.plan[1].from), 15, 'usual wait after the Salt Cave');
  assert.equal(min(j.plan[1].to, j.plan[2].from), 0);
});

test('Cold Plunge before Sauna keeps the usual 30 min wait', () => {
  const j = buildJourneyPlan(START, [COLD, SAUNA]);
  assert.equal(min(j.plan[0].to, j.plan[1].from), 30);
});

// Room bookings already in the diary, as [room, from IST, to IST, buffer min].
const ROOMS = new Map([
  ['sauna', { id: 'sauna', name: 'Infrared Sauna Room', capacity: 1, active: true, branchId: null }],
  ['cold', { id: 'cold', name: 'Cold Plunge Pool', capacity: 1, active: true, branchId: null }],
]);
const ist = (hhmm) => new Date(`2027-01-20T${hhmm}:00+05:30`).toISOString();
async function fits(therapy, plan, existing) {
  const scheduleByResource = new Map([['sauna', []], ['cold', []]]);
  for (const [room, from, to, bufferMin] of existing) {
    scheduleByResource.get(room).push({ startsAt: ist(from), endsAt: ist(to), bufferMin, therapySlug: 'x', guests: 1 });
  }
  const context = { blocks: [], resourcesById: ROOMS, scheduleByResource, maintenanceByResource: new Map() };
  return checkJourneyAvailability({ plan, therapies: therapy, branchId: null, context });
}
const option1 = (from) => {
  const j = buildJourneyPlan(new Date(ist(from)), [CONTRAST]);
  return j.plan;
};

test('Option 1 — both rooms free: books the Sauna room and the Cold Plunge pool', async () => {
  const r = await fits([CONTRAST], option1('10:00'), []);
  assert.equal(r.ok, true);
  assert.deepEqual(r.assignments.map((a) => a.resourceId).sort(), ['cold', 'sauna']);
});

const OPTION1 = [
  // [name, existing room bookings, fits at 10:00]
  ['Sauna busy at 10:30', [['sauna', '10:30', '11:00', 30]], false],
  ['Cold Plunge busy at 10:45', [['cold', '10:45', '11:15', 30]], false],
  ['Sauna booking 09:00–09:30 (room free from 10:00)', [['sauna', '09:00', '09:30', 30]], true],
  ['Cold Plunge booking 09:15–09:45 (room held until 10:15)', [['cold', '09:15', '09:45', 30]], false],
  ['next booking at 11:45 (both rooms held 45 min after)', [['sauna', '11:45', '12:15', 30]], true],
  ['next booking at 11:30 (inside the 45 min after)', [['cold', '11:30', '12:00', 30]], false],
];
for (const [name, existing, ok] of OPTION1) {
  test(`Option 1 — ${name}`, async () => {
    const r = await fits([CONTRAST], option1('10:00'), existing);
    assert.equal(r.ok, ok);
  });
}

test('Option 2 — Sauna free but Cold Plunge busy straight after: not offered', async () => {
  const j = buildJourneyPlan(new Date(ist('10:00')), [SAUNA, COLD]);
  const r = await fits([SAUNA, COLD], j.plan, [['cold', '10:15', '10:45', 30]]);
  assert.equal(r.ok, false);
});

test('Option 2 — Cold Plunge busy only at 10:00: fine, the plunge is at 10:30', async () => {
  const j = buildJourneyPlan(new Date(ist('10:00')), [SAUNA, COLD]);
  const r = await fits([SAUNA, COLD], j.plan, [['cold', '09:00', '09:30', 30]]);
  assert.equal(r.ok, true);
});
