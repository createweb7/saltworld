// FINAL master data migration — Salt World.
// Idempotent. Aligns all therapies/resources with the 26-Aug production
// spec so a single source of truth drives every surface.

import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';

const url    = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'saltworld';
if (!url) throw new Error('MONGO_URL missing');
const client = new MongoClient(url);
await client.connect();
const db = client.db(dbName);

// ---------------------------------------------------------------------------
// 1. Therapies — durations, buffers, per-therapy capacity & slot-lock
// ---------------------------------------------------------------------------
//   slotLock=true  → one booking closes the slot for all other bookings
//   slotLock=false → additive capacity (Salt Cave allows up to 7 concurrent)
//   maxCapacity    → max people per single booking
//   minLeadTimeMin → min minutes ahead a booking may start
//   cleaningBufferMin → post-session buffer that must elapse before next start
const THERAPY_CONFIG = [
  {
    slug: 'salt-therapy', name: 'Salt Therapy', durationMin: 60,
    preBufferMin: 0, postBufferMin: 0, cleaningBufferMin: 20,
    maxCapacity: 7, slotLock: false, minLeadTimeMin: 30,
    displayDurationLabel: '60 min',
  },
  {
    // NEW variant of Salt Therapy for children — max 3 total in the slot.
    slug: 'kids-salt-therapy', name: 'Kids Salt Therapy', durationMin: 60,
    preBufferMin: 0, postBufferMin: 0, cleaningBufferMin: 20,
    maxCapacity: 3, slotLock: false, minLeadTimeMin: 30,
    displayDurationLabel: '60 min',
    variantOf: 'salt-therapy', // shares the Salt Cave resource
  },
  {
    slug: 'float-therapy', name: 'Float Therapy', durationMin: 60,
    preBufferMin: 0, postBufferMin: 30, cleaningBufferMin: 30,
    maxCapacity: 1, slotLock: true, minLeadTimeMin: 90,
    displayDurationLabel: '60 min',
    // Special Float rule: next start after any Float session must respect
    // an additional 60-min inter-slot buffer (see /lib/booking-rules.js).
    interSlotBufferMin: 60,
    allowedDurationsMin: [60, 90],
  },
  {
    slug: 'red-light-therapy', name: 'Red Light Therapy', durationMin: 30,
    preBufferMin: 0, postBufferMin: 0, cleaningBufferMin: 15,
    maxCapacity: 2, slotLock: true, minLeadTimeMin: 15,
    displayDurationLabel: '30 min',
  },
  {
    slug: 'infrared-sauna', name: 'Infrared Sauna', durationMin: 30,
    preBufferMin: 0, postBufferMin: 0, cleaningBufferMin: 30,
    maxCapacity: 2, slotLock: true, minLeadTimeMin: 15,
    displayDurationLabel: '30 min',
  },
  {
    slug: 'cold-plunge', name: 'Cold Plunge', durationMin: 30,
    preBufferMin: 0, postBufferMin: 0, cleaningBufferMin: 30,
    maxCapacity: 5, slotLock: true, minLeadTimeMin: 30,
    displayDurationLabel: '30 min',
  },
  {
    slug: 'hot-cold-contrast', name: 'Hot & Cold Contrast', durationMin: 30,
    preBufferMin: 0, postBufferMin: 0, cleaningBufferMin: 30,
    maxCapacity: 5, slotLock: true, minLeadTimeMin: 30,
    displayDurationLabel: '30 min',
  },
];

let therapiesUpserted = 0;
for (const cfg of THERAPY_CONFIG) {
  const existing = await db.collection('therapies').findOne({ slug: cfg.slug });
  const now = new Date().toISOString();
  const set = { ...cfg, updatedAt: now };
  if (!existing) {
    await db.collection('therapies').insertOne({
      id: randomUUID(), createdAt: now,
      description: cfg.name, active: true,
      defaultPrice: cfg.slug === 'float-therapy' ? 3000
                  : cfg.slug === 'kids-salt-therapy' ? 800
                  : cfg.slug === 'hot-cold-contrast' ? 1200
                  : 1500,
      resourceIds: [],
      ...set,
    });
  } else {
    await db.collection('therapies').updateOne({ id: existing.id }, { $set: set });
  }
  therapiesUpserted++;
}
console.log(`therapies aligned: ${therapiesUpserted}`);

// ---------------------------------------------------------------------------
// 2. Resources — ensure Hot & Cold Contrast has a resource, ensure capacities
// ---------------------------------------------------------------------------
const branches = await db.collection('branches').find({ isDefault: true }).toArray();
const defaultBranchId = branches[0]?.id;

// Salt Cave — set capacity=7 (was 1)
await db.collection('resources').updateMany(
  { therapySlug: 'salt-therapy' },
  { $set: { capacity: 7, supportedTherapies: ['salt-therapy', 'kids-salt-therapy'] } },
);
// Ensure the Kids variant's resourceIds also point at the Salt Cave.
const saltRes = await db.collection('resources').find({ therapySlug: 'salt-therapy' }).toArray();
const saltResIds = saltRes.map((r) => r.id);
if (saltResIds.length > 0) {
  await db.collection('therapies').updateOne(
    { slug: 'kids-salt-therapy' },
    { $set: { resourceIds: saltResIds } },
  );
  await db.collection('therapies').updateOne(
    { slug: 'salt-therapy' },
    { $set: { resourceIds: saltResIds } },
  );
}

// Ensure single-lock therapies inherit capacity=1
for (const slug of ['red-light-therapy', 'infrared-sauna', 'cold-plunge']) {
  await db.collection('resources').updateMany(
    { therapySlug: slug },
    { $set: { capacity: 1 } },
  );
  const rs = await db.collection('resources').find({ therapySlug: slug }).toArray();
  await db.collection('therapies').updateOne(
    { slug },
    { $set: { resourceIds: rs.map((r) => r.id) } },
  );
}

// Float tanks — capacity 1 each; ensure both tanks exist.
await db.collection('resources').updateMany(
  { therapySlug: 'float-therapy' },
  { $set: { capacity: 1 } },
);
const floatRs = await db.collection('resources').find({ therapySlug: 'float-therapy' }).toArray();
await db.collection('therapies').updateOne(
  { slug: 'float-therapy' },
  { $set: { resourceIds: floatRs.map((r) => r.id) } },
);

// Hot & Cold Contrast — reuse the Cold Plunge pool as its resource for MVP.
// (Both are pool-based, single-user pipeline.)
const cpRes = await db.collection('resources').find({ therapySlug: 'cold-plunge' }).toArray();
if (cpRes.length > 0) {
  await db.collection('resources').updateMany(
    { id: { $in: cpRes.map((r) => r.id) } },
    { $set: { supportedTherapies: ['cold-plunge', 'hot-cold-contrast'] } },
  );
  await db.collection('therapies').updateOne(
    { slug: 'hot-cold-contrast' },
    { $set: { resourceIds: cpRes.map((r) => r.id) } },
  );
}

console.log(`resources aligned. defaultBranchId=${defaultBranchId}`);

// ---------------------------------------------------------------------------
// 3. Booking rules — align with spec (per-therapy lead time + special cutoffs)
// ---------------------------------------------------------------------------
const rulesValue = {
  // legacy cancel/reschedule
  cutoffTime: '21:00', cutoffDaysBefore: 1, minRescheduleNoticeMin: 0,
  // per-therapy lead time
  defaultMinLeadTimeMin: 30,
  perTherapyLeadMin: {
    'float-therapy':      90,
    'salt-therapy':       30,
    'kids-salt-therapy':  30,
    'red-light-therapy':  15,
    'infrared-sauna':     15,
    'cold-plunge':        30,
    'hot-cold-contrast':  30,
  },
  nextDayEarlyCutoff: {
    cutoffHourIst: 21,
    buckets: [
      { slugs: ['salt-therapy', 'kids-salt-therapy', 'red-light-therapy', 'infrared-sauna'], cutoffTime: '08:30' },
      { slugs: ['float-therapy', 'cold-plunge', 'hot-cold-contrast'],                        cutoffTime: '09:00' },
    ],
  },
  sameDayLateCutoff: { sameDayCutoffHourIst: 19, sameDayLastBookableHourIst: 20 },
};
await db.collection('settings').updateOne(
  { key: 'bookingRules' },
  { $set: { key: 'bookingRules', value: rulesValue, updatedAt: new Date().toISOString() }, $setOnInsert: { createdAt: new Date().toISOString() } },
  { upsert: true },
);
console.log('bookingRules aligned');

await client.close();
console.log('done.');
