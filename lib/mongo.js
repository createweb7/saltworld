import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'saltworld';

let _client;
let _db;
let _migrationsDone = false;

// Backfills `branchId` on all pre-existing rows to the default branch.
// Runs at most once per process. Idempotent — only touches docs where
// branchId is missing or null.
async function runBranchMigration(db) {
  if (_migrationsDone) return;
  _migrationsDone = true;
  try {
    // Ensure the default branch row exists.
    let defaultBranch = await db.collection('branches').findOne({ isDefault: true });
    if (!defaultBranch) defaultBranch = await db.collection('branches').findOne({});
    if (!defaultBranch) {
      // /admin/branches auto-seeds on first read; skip until then.
      _migrationsDone = false;
      return;
    }
    const bid = defaultBranch.id;
    const targets = [
      'customers', 'bookings', 'memberships', 'subscriptions',
      'giftcards', 'invoices', 'payments', 'products',
      'services', 'resources', 'communications', 'activityLog',
      'bookingPayments', 'templates', 'productCategories', 'blog', 'mini_blog',
    ];
    for (const name of targets) {
      try {
        await db.collection(name).updateMany(
          { $or: [{ branchId: { $exists: false } }, { branchId: null }] },
          { $set: { branchId: bid } },
        );
      } catch { /* collection may not exist yet */ }
    }
  } catch { /* swallow, migration is best-effort */ }
}

export async function getDb() {
  if (_db) {
    // Kick off migration lazily; safe to call multiple times.
    runBranchMigration(_db);
    return _db;
  }
  if (!uri) throw new Error('MONGO_URL missing');
  _client = new MongoClient(uri, { maxPoolSize: 10 });
  await _client.connect();
  _db = _client.db(dbName);
  await _db.collection('pages').createIndex({ slug: 1 }, { unique: true });
  await _db.collection('pages').createIndex({ updatedAt: -1 });
  await _db.collection('branches').createIndex({ code: 1 }, { unique: true, sparse: true });
  await _db.collection('bookings').createIndex({ branchId: 1, createdAt: -1 });
  await _db.collection('customers').createIndex({ branchId: 1, createdAt: -1 });
  // Fire migration once db is ready; do not await so the first request isn't blocked.
  runBranchMigration(_db);
  return _db;
}

export const clean = (d) => {
  if (!d) return d;
  const { _id, ...rest } = d;
  return rest;
};
