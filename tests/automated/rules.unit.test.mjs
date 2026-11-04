// Booking time rules, tested offline against lib/booking-rules.js with fixed
// clock times (so results don't depend on when the suite runs). No network,
// no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCanBook, crossServiceConflict } from '../../lib/booking-rules.js';
import { RULES } from './support/helpers.mjs';

const rules = {
  defaultMinLeadTimeMin: 30,
  perTherapyLeadMin: RULES.leadMin,
  nextDayEarlyCutoff: {
    cutoffHourIst: 21,
    buckets: [
      { slugs: ['salt-therapy', 'red-light-therapy', 'infrared-sauna'], cutoffTime: '08:30' },
      { slugs: ['float-therapy', 'cold-plunge'], cutoffTime: '09:00' },
    ],
  },
  closeBufferMin: 60,
  lastStartTime: RULES.lastSlot,
  sameDayLateCutoff: { afterTime: '19:00', slotsAfter: '20:00' },
};

const D = '2027-01-20';      // slot day
const PREV = '2027-01-19';   // the night before
const ist = (d, t) => new Date(`${d}T${t}:00+05:30`).toISOString();

const check = (slug, startDay, startTime, nowDay, nowTime) => assertCanBook({
  therapies: [slug], startIso: ist(startDay, startTime), nowIso: ist(nowDay, nowTime),
  preloadedRules: rules, closeTimeHHmm: '23:30',
});

const CASES = [
  // [name, slug, start day, start, now day, now, allowed, code if blocked]
  ['Float needs 90 min notice — 60 min blocked', 'float-therapy', D, '10:30', D, '09:30', false, 'below_min_lead_time'],
  ['Float needs 90 min notice — 90 min allowed', 'float-therapy', D, '10:30', D, '09:00', true],
  ['Cold Plunge needs 45 min — 30 min blocked', 'cold-plunge', D, '12:00', D, '11:30', false, 'below_min_lead_time'],
  ['Cold Plunge needs 45 min — 45 min allowed', 'cold-plunge', D, '12:00', D, '11:15', true],
  ['Salt needs 30 min — 15 min blocked', 'salt-therapy', D, '12:00', D, '11:45', false, 'below_min_lead_time'],
  ['Infrared Sauna needs 15 min — allowed', 'infrared-sauna', D, '12:00', D, '11:45', true],
  ['Red Light needs 15 min — allowed', 'red-light-therapy', D, '12:00', D, '11:45', true],
  ['Last slot 21:00 allowed', 'salt-therapy', D, '21:00', PREV, '10:00', true],
  ['After last slot (21:15) blocked', 'salt-therapy', D, '21:15', PREV, '10:00', false, 'after_last_slot'],
  ['Evening cutoff — before 19:00, 20:30 today allowed', 'salt-therapy', D, '20:30', D, '18:30', true],
  ['Evening cutoff — after 19:00, 20:30 today blocked', 'salt-therapy', D, '20:30', D, '19:30', false, 'same_day_late_cutoff'],
  ['Evening cutoff — after 19:00, 20:00 today still allowed', 'salt-therapy', D, '20:00', D, '19:30', true],
  ['Next morning — after 21:00, Salt 08:30 blocked', 'salt-therapy', D, '08:30', PREV, '21:30', false, 'next_day_early_cutoff'],
  ['Next morning — after 21:00, Salt 08:45 allowed', 'salt-therapy', D, '08:45', PREV, '21:30', true],
  ['Next morning — after 21:00, Cold Plunge 09:00 blocked', 'cold-plunge', D, '09:00', PREV, '21:30', false, 'next_day_early_cutoff'],
  ['Next morning — after 21:00, Float 08:00 blocked', 'float-therapy', D, '08:00', PREV, '21:30', false, 'next_day_early_cutoff'],
  ['Next morning — before 21:00, Float 08:00 allowed', 'float-therapy', D, '08:00', PREV, '20:30', true],
  ['Past time blocked', 'salt-therapy', D, '10:00', D, '11:00', false, 'past_time'],
];

for (const [name, slug, sd, st, nd, nt, allowed, code] of CASES) {
  test(`rule — ${name}`, async () => {
    const r = await check(slug, sd, st, nd, nt);
    assert.equal(r.ok, allowed, r.message);
    if (!allowed) assert.equal(r.code, code);
  });
}

// Same customer, separate bookings: gap after whichever therapy comes first.
// Existing: Salt 10:00–11:00.
const day = {
  rows: [{ id: 'salt', start_at: ist(D, '10:00') }],
  firstStepBySlug: new Map([['salt', { therapy_slug: 'salt-therapy', starts_at: ist(D, '10:00') }]]),
  durBySlug: { 'salt-therapy': 60 },
};
const OWN = [
  ['Sauna 15 min after own Salt — allowed (Salt gap 15)', ['infrared-sauna'], '11:15', '11:45', true],
  ['Sauna 10 min after own Salt — blocked', ['infrared-sauna'], '11:10', '11:40', false],
  ['Sauna ending 30 min before own Salt — allowed (Sauna gap 30)', ['infrared-sauna'], '09:00', '09:30', true],
  ['Sauna ending 15 min before own Salt — blocked', ['infrared-sauna'], '09:15', '09:45', false],
  ['Overlapping own Salt — blocked', ['float-therapy'], '10:30', '11:30', false],
];
for (const [name, therapies, from, to, allowed] of OWN) {
  test(`own bookings — ${name}`, () => {
    const c = crossServiceConflict(day, { therapies, startIso: ist(D, from), endIso: ist(D, to) });
    assert.equal(!c, allowed, c?.message);
  });
}
