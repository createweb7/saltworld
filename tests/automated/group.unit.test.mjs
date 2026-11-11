// Group and Kids booking limits (lib/group-booking.js), tested offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupConfig, kidsAllowed, checkPartySize } from '../../lib/group-booking.js';

const SALT = { slug: 'salt-therapy', name: 'Salt Therapy', maxCapacity: 7, defaultPrice: 1600, additionalGuestPriceInr: 1200, childPriceInr: 1600 };
const COLD = { slug: 'cold-plunge', name: 'Cold Plunge', maxCapacity: 1, defaultPrice: 960 };
const SAUNA = { slug: 'infrared-sauna', name: 'Infrared Sauna', maxCapacity: 1, defaultPrice: 2600 };

test('group — Salt Cave up to 7 at ₹1,200 each, Cold Plunge up to 5 at ₹720 each', () => {
  assert.deepEqual(groupConfig(SALT), { maxGuests: 7, perPersonInr: 1200, shared: true });
  assert.deepEqual(groupConfig(COLD), { maxGuests: 5, perPersonInr: 720, shared: false });
  assert.equal(groupConfig(SAUNA), null);
});

test('kids — Salt Cave only', () => {
  assert.equal(kidsAllowed(SALT), true);
  assert.equal(kidsAllowed(COLD), false);
});

const CASES = [
  // [name, therapies, adults, children, error or null]
  ['Salt group of 7', [SALT], 7, 0, null],
  ['Salt group of 8', [SALT], 8, 0, 'guest_cap_exceeded'],
  ['Cold Plunge group of 5', [COLD], 5, 0, null],
  ['Cold Plunge group of 6', [COLD], 6, 0, 'guest_cap_exceeded'],
  ['Sauna group of 3', [SAUNA], 3, 0, 'group_not_offered'],
  ['Salt + Cold group of 3', [SALT, COLD], 3, 0, 'group_not_offered'],
  ['Couple on a combo still fine', [SALT, COLD], 2, 0, null],
  ['Kids — 2 children + 1 adult', [SALT], 1, 2, null],
  ['Kids — 1 child + 2 adults', [SALT], 2, 1, null],
  ['Kids — 2 children + 2 adults is over 3', [SALT], 2, 2, 'kids_cap_exceeded'],
  ['Kids — Cold Plunge', [COLD], 1, 1, 'kids_not_offered'],
  ['Kids — Salt combo', [SALT, COLD], 1, 1, 'kids_not_offered'],
];
for (const [name, therapies, adults, kids, err] of CASES) {
  test(`party size — ${name}`, () => {
    assert.equal(checkPartySize(therapies, adults, kids)?.error ?? null, err);
  });
}

// Salt Cave slot capacity with kids (rules doc: a session with kids holds at
// most 3 people), checked against made-up existing bookings — no database.
import { checkJourneyAvailability } from '../../lib/scheduling.js';

const ROOM = { id: 'cave', name: 'Salt Cave', capacity: 7, active: true, branchId: null };
const FROM = '2027-01-20T04:30:00.000Z', TO = '2027-01-20T05:30:00.000Z'; // 10:00–11:00 IST
const existing = (guests, children = 0) => ({ startsAt: FROM, endsAt: TO, therapySlug: 'salt-therapy', bufferMin: 0, guests, children });
async function fits(already, guests, children) {
  const context = {
    blocks: [], resourcesById: new Map([['cave', ROOM]]),
    scheduleByResource: new Map([['cave', already]]), maintenanceByResource: new Map(),
  };
  const r = await checkJourneyAvailability({
    plan: [{ therapySlug: 'salt-therapy', from: FROM, to: TO, guests, children }],
    therapies: [{ slug: 'salt-therapy', resourceIds: ['cave'] }], branchId: null, context,
  });
  return r.ok;
}
const SLOT = [
  // [name, existing bookings, adults, children, fits]
  ['group of 7 in an empty slot', [], 7, 0, true],
  ['group of 3 next to 4 adults', [existing(4)], 3, 0, true],
  ['group of 4 next to 4 adults', [existing(4)], 4, 0, false],
  ['kids 2 + 1 adult in an empty slot', [], 1, 2, true],
  ['kids 1 + 1 adult next to 1 adult (3 total)', [existing(1)], 1, 1, true],
  ['kids 1 + 1 adult next to 2 adults (4 total)', [existing(2)], 1, 1, false],
  ['adult couple next to a kids booking of 2 (4 total)', [existing(1, 1)], 2, 0, false],
  ['one adult next to a kids booking of 2 (3 total)', [existing(1, 1)], 1, 0, true],
];
for (const [name, already, adults, kids, ok] of SLOT) {
  test(`Salt Cave slot — ${name}`, async () => {
    assert.equal(await fits(already, adults, kids), ok);
  });
}
