import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'saltworld';

let _client;
let _db;

export async function getDb() {
  if (_db) return _db;
  if (!uri) throw new Error('MONGO_URL missing');
  _client = new MongoClient(uri, { maxPoolSize: 10 });
  await _client.connect();
  _db = _client.db(dbName);
  await _db.collection('pages').createIndex({ slug: 1 }, { unique: true });
  await _db.collection('pages').createIndex({ updatedAt: -1 });
  return _db;
}

export const clean = (d) => {
  if (!d) return d;
  const { _id, ...rest } = d;
  return rest;
};
