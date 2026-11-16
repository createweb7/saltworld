// Held sessions (lib/held-sessions.js) — value of unused sessions, 1-year
// validity, refund cap. Offline, no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heldExpiry, heldStatus, packageValueInr, sessionValues, heldRefundedInr, refundableInr } from '../../lib/held-sessions.js';

// Solo 5-therapy package, Float 60: list prices sum to ₹10,360, charged ₹8,400.
const LINES = [
  { slug: 'infrared-sauna', priceInr: 2600 },
  { slug: 'cold-plunge', priceInr: 960 },
  { slug: 'red-light-therapy', priceInr: 2200 },
  { slug: 'salt-therapy', priceInr: 1600 },
  { slug: 'float-therapy', priceInr: 3000 },
];
const paidOnline = { total: 8400, pricingBreakdown: { lines: LINES, payableInr: 8400, discounts: { bundle: { amountInr: 1960 } } } };
const paidByGiftCard = { total: 0, pricingBreakdown: { lines: LINES, payableInr: 0, discounts: { giftCard: { amountInr: 8400 } } } };

test('package value — what the guest paid, in money, gift card or wallet', () => {
  assert.equal(packageValueInr(paidOnline), 8400);
  assert.equal(packageValueInr(paidByGiftCard), 8400);
  assert.equal(packageValueInr({ total: 3000 }), 3000);
});

test('session values — each therapy’s share of the package price, by its list price', () => {
  const v = sessionValues(paidOnline);
  assert.equal(Object.values(v).reduce((a, b) => a + b, 0), 8400, 'shares add up to the package price');
  assert.ok(Math.abs(v['float-therapy'] - (8400 * 3000) / 10360) <= 1, 'Float ≈ its share (last line takes the rounding)');
  assert.ok(v['float-therapy'] > v['red-light-therapy']);
  assert.deepEqual(Object.keys(sessionValues(paidOnline, ['float-therapy', 'red-light-therapy'])), ['float-therapy', 'red-light-therapy']);
});

test('session values — no price lines: equal split', () => {
  const v = sessionValues({ total: 3000, therapies: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] });
  assert.deepEqual(v, { a: 1000, b: 1000, c: 1000 });
});

test('validity — 1 year from the date of purchase', () => {
  assert.equal(heldExpiry('2026-11-16T10:00:00.000Z'), '2027-11-16T10:00:00.000Z');
  const s = { status: 'held', expiresAt: '2027-11-16T10:00:00.000Z' };
  assert.equal(heldStatus(s, new Date('2027-11-16T09:00:00Z')), 'held');
  assert.equal(heldStatus(s, new Date('2027-11-17T00:00:00Z')), 'expired');
  assert.equal(heldStatus({ ...s, status: 'rebooked' }, new Date('2028-01-01')), 'rebooked');
});

test('refund cap — never more than the package price in total', () => {
  const b = { ...paidOnline, heldSessions: [
    { status: 'refunded', refundInr: 2000 },
    { status: 'held', valueInr: 1700 },
    { status: 'rebooked', valueInr: 500 },
  ] };
  assert.equal(heldRefundedInr(b), 2000);
  assert.equal(refundableInr(b), 6400);
});
