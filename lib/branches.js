// Multi-branch support — helpers to load, resolve and scope by branch.
// Every mutable entity should carry a branchId. Legacy rows without a branchId
// are treated as belonging to the default (first active) branch so nothing breaks.

import { getDb } from '@/lib/mongo';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

const BRANCH_COOKIE = 'sw_branch';
const SEED_TIMEZONE = 'Asia/Kolkata';

async function seedDefaultBranch(db) {
  const now = new Date().toISOString();
  const doc = {
    id: randomUUID(),
    code: 'HSR',
    name: 'HSR Layout',
    address: 'Site 1, 2nd floor, 18th Main, HSR Layout, Sector 3, Bengaluru 560102',
    phone: '+917687878793',
    whatsapp: '917687878793',
    email: 'info@saltworld.in',
    timezone: SEED_TIMEZONE,
    currency: 'INR',
    status: 'active',
    isDefault: true,
    hours: {
      monday:    { open: true, from: '06:00', to: '21:00' },
      tuesday:   { open: true, from: '06:00', to: '21:00' },
      wednesday: { open: true, from: '06:00', to: '21:00' },
      thursday:  { open: true, from: '06:00', to: '21:00' },
      friday:    { open: true, from: '06:00', to: '21:00' },
      saturday:  { open: true, from: '07:00', to: '21:00' },
      sunday:    { open: true, from: '07:00', to: '20:00' },
    },
    holidays: [],
    createdAt: now, updatedAt: now,
  };
  await db.collection('branches').insertOne(doc);
  return doc;
}

export async function getBranches({ activeOnly = false } = {}) {
  const db = await getDb();
  const query = activeOnly ? { status: 'active' } : {};
  let docs = await db.collection('branches').find(query).sort({ isDefault: -1, createdAt: 1 }).toArray();
  if (docs.length === 0) {
    const seeded = await seedDefaultBranch(db);
    docs = [seeded];
  }
  return docs.map(({ _id, ...rest }) => rest);
}

export async function getDefaultBranch() {
  const all = await getBranches();
  return all.find((b) => b.isDefault) || all[0] || null;
}

export async function getBranchById(id) {
  if (!id) return null;
  const db = await getDb();
  const doc = await db.collection('branches').findOne({ id });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

// Read the current branch from the sw_branch cookie set by the admin top-bar switcher.
// Falls back to the default branch when the cookie is missing or invalid.
export async function getCurrentBranchFromCookies() {
  const jar = await cookies();
  const id = jar.get(BRANCH_COOKIE)?.value;
  if (id) {
    const b = await getBranchById(id);
    if (b) return b;
  }
  return getDefaultBranch();
}

// Server helper for backfilling legacy rows during the transition period.
export async function ensureBranchId(entity) {
  if (entity?.branchId) return entity;
  const def = await getDefaultBranch();
  return { ...entity, branchId: def?.id || null };
}

export const BRANCH_COOKIE_NAME = BRANCH_COOKIE;
