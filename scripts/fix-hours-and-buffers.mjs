// One-shot data fix per user report on 23-Aug-2026:
//   1. Branch hours were 06:00-21:00 (Mon-Fri) / 07:00-21:00 (Sat/Sun).
//      User expectation: first slot 08:00, last slot 20:00 (customer facing).
//   2. cold-plunge had preBufferMin=25 which is likely a data-entry glitch
//      (all other therapies use 3-5 min). Reset to 5.
//
// Idempotent — safe to re-run.
import { MongoClient } from 'mongodb';

const url = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'saltworld';
if (!url) throw new Error('MONGO_URL missing');

const client = new MongoClient(url);
await client.connect();
const db = client.db(dbName);

const HOURS = {
  monday:    { open: true, from: '08:00', to: '20:00' },
  tuesday:   { open: true, from: '08:00', to: '20:00' },
  wednesday: { open: true, from: '08:00', to: '20:00' },
  thursday:  { open: true, from: '08:00', to: '20:00' },
  friday:    { open: true, from: '08:00', to: '20:00' },
  saturday:  { open: true, from: '08:00', to: '20:00' },
  sunday:    { open: true, from: '08:00', to: '20:00' },
};

const bRes = await db.collection('branches').updateMany(
  {},
  { $set: { hours: HOURS, updatedAt: new Date().toISOString() } },
);
console.log(`branches updated: ${bRes.modifiedCount}`);

const tRes = await db.collection('therapies').updateOne(
  { slug: 'cold-plunge' },
  { $set: { preBufferMin: 5, updatedAt: new Date().toISOString() } },
);
console.log(`cold-plunge preBuffer fixed: ${tRes.modifiedCount}`);

// Also update business-settings hours to match (kept in `settings` collection).
const sRes = await db.collection('settings').updateOne(
  { key: 'business' },
  { $set: { 'value.hours': HOURS } },
  { upsert: false },
);
console.log(`settings.business.hours synced: ${sRes.modifiedCount}`);

await client.close();
console.log('done.');
