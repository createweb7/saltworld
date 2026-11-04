// Every therapy and combo, Solo and Couple, Float 60/90: the price the site
// charges must match the agreed price list (fixtures/combo-prices.json,
// taken from saltworld.in/pricing). Read-only — only calls the price
// calculator, never creates anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, loadJson, bookLines, guestsFor } from './support/helpers.mjs';

const PRICES = loadJson('../fixtures/combo-prices.json');

async function quote(slugs, mode, floatMin) {
  const r = await api('/api/pricing/quote', {
    method: 'POST',
    body: { therapies: bookLines(slugs, mode, floatMin), guests: guestsFor(slugs, mode) },
  });
  assert.equal(r.status, 200);
  return r.json;
}

for (const row of PRICES) {
  const label = `${row.name}${row.floatMin ? ` (Float ${row.floatMin})` : ''}`;

  test(`price — ${label} — Solo ₹${row.solo}`, async () => {
    const q = await quote(row.slugs, 'single', row.floatMin);
    assert.equal(q.payableInr, row.solo);
  });

  test(`price — ${label} — Couple ₹${row.couple}`, async () => {
    const q = await quote(row.slugs, 'couple', row.floatMin);
    assert.equal(q.payableInr, row.couple);
  });

  if (row.slugs.length > 1) {
    test(`price — ${label} — combo cheaper than booking separately`, () => {
      assert.ok(row.solo < row.soloSeparate, `Solo ${row.solo} should be < ${row.soloSeparate}`);
      assert.ok(row.couple < row.coupleSeparate, `Couple ${row.couple} should be < ${row.coupleSeparate}`);
    });
  }
}

// The gift page quotes Float at 60 min for Solo and 90 min for Couple; the
// server charges the gift with those same inputs.
test('gift prices — Couple Float ₹5,000, Couple Salt + Sauna + Float ₹9,000', async () => {
  assert.equal((await quote(['float-therapy'], 'couple', 90)).payableInr, 5000);
  assert.equal((await quote(['salt-therapy', 'infrared-sauna', 'float-therapy'], 'couple', 90)).payableInr, 9000);
});

test('no bundle price when children are on the booking', async () => {
  const r = await api('/api/pricing/quote', {
    method: 'POST',
    body: { therapies: bookLines(['salt-therapy', 'float-therapy'], 'single', 60), guests: 1, children: 1 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.discounts?.bundle ?? null, null);
});
