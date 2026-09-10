// One-shot data fix to match the "Rules for Booking" product spec (10-Sep-2026):
//   1. Branch hours widened to 23:30 (operational padding so a 9 PM last-slot
//      booking's cleaning buffer isn't rejected by the "visit must fit in
//      business hours" check). Customer-facing last-bookable-slot times are
//      enforced separately, per therapy, in code (lib/booking-rules.js).
//   2. settings.business.hours (admin-facing display record) set to the true
//      public last-slot time — 09:00-21:00 — distinct from the branch's
//      operational close time above.
//   3. Hot & Cold Contrast reworked from a single fake 30-min therapy (only
//      reserving the Cold Plunge Pool — the Sauna room was never locked, so
//      it could silently double-book) into a real 60-min combo that locks
//      BOTH the Infrared Sauna Room and Cold Plunge Pool simultaneously.
//   4. Float Tank given a durationOptions price matrix (60/90-min x
//      single/couple), matching the live pricing at saltworld.in.
//
// Idempotent — safe to re-run.
import { MongoClient } from 'mongodb';

const url = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'saltworld';
if (!url) throw new Error('MONGO_URL missing');

const client = new MongoClient(url);
await client.connect();
const db = client.db(dbName);

// ---- 1. Branch hours — operational padding for post-9PM cleanup ----------
const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const branchSet = {};
for (const d of days) branchSet[`hours.${d}.to`] = '23:30';
const bRes = await db.collection('branches').updateMany({}, { $set: branchSet });
console.log(`branches close-hour widened: ${bRes.modifiedCount}`);

// ---- 2. settings.business.hours — customer-facing display record --------
const displayHours = {};
for (const d of days) displayHours[d] = { open: true, from: '08:00', to: '21:00' };
const sRes = await db.collection('settings').updateOne(
  { key: 'business' },
  { $set: { 'value.hours': displayHours, updatedAt: new Date().toISOString() } },
);
console.log(`settings.business.hours synced: ${sRes.modifiedCount}`);

// ---- 3. Hot & Cold Contrast — real dual-resource combo -------------------
const saunaRoom = await db.collection('resources').findOne({ type: 'sauna_room' });
const plungePool = await db.collection('resources').findOne({ type: 'plunge_pool' });
if (saunaRoom && plungePool) {
  const hcRes = await db.collection('therapies').updateOne(
    { slug: 'hot-cold-contrast' },
    { $set: {
        durationMin: 60,
        displayDurationLabel: '60 min',
        resourceIds: [saunaRoom.id, plungePool.id],
        concurrentResources: true,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  console.log(`hot-cold-contrast reworked as dual-resource combo: ${hcRes.modifiedCount}`);
} else {
  console.warn('hot-cold-contrast fix SKIPPED — sauna_room or plunge_pool resource not found');
}

// ---- 4. Float Tank — 60/90-min x single/couple price matrix --------------
const durationOptions = [
  { durationMin: 60, priceSingle: 3000, priceCouple: 4000, priceCoupleOriginal: 6000, label: '60 min' },
  { durationMin: 90, priceSingle: 4000, priceCouple: 5000, priceCoupleOriginal: 8000, label: '90 min' },
];
const fRes = await db.collection('therapies').updateOne(
  { slug: 'float-therapy' },
  { $set: { durationOptions, updatedAt: new Date().toISOString() } },
);
console.log(`float-therapy durationOptions set: ${fRes.modifiedCount}`);

await client.close();
console.log('done.');
