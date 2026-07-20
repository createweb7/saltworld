// Salt World BOS — seed the default super admin on first admin route hit.
// Idempotent. Safe to call from route handlers.

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/mongo';
import { seedSystemTherapies } from '@/lib/therapies-seed';

let _seeded = false;

export async function ensureSeed() {
  if (_seeded) return;
  const db = await getDb();

  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ id: 1 }, { unique: true });
  await db.collection('customers').createIndex({ id: 1 }, { unique: true });
  await db.collection('customers').createIndex({ phone: 1 });
  await db.collection('customers').createIndex({ email: 1 });
  await db.collection('customers').createIndex({ name: 'text', email: 'text', phone: 'text' });
  await db.collection('bookings').createIndex({ startAt: 1 });
  await db.collection('bookings').createIndex({ customerId: 1 });
  await db.collection('bookings').createIndex({ id: 1 }, { unique: true });
  await db.collection('activityLog').createIndex({ createdAt: -1 });
  await db.collection('activityLog').createIndex({ actorId: 1 });
  await db.collection('giftcards').createIndex({ code: 1 }, { unique: true });

  const users = db.collection('users');
  const count = await users.countDocuments({});
  if (count === 0) {
    const email = process.env.ADMIN_SEED_EMAIL || 'admin@saltworld.in';
    const password = process.env.ADMIN_SEED_PASSWORD || 'SaltWorld@2025';
    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({
      id: randomUUID(),
      email: email.toLowerCase(),
      name: 'Salt World Admin',
      passwordHash,
      role: 'super_admin',
      permissions: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
  }

  _seeded = true;

  // Seed system therapies (5 master therapies) + default resources.
  // Idempotent — safe to run every request; internal fast-path if already seeded.
  try { await seedSystemTherapies(); } catch (e) { console.error('seedSystemTherapies failed', e); }
  try {
    const { seedMembershipPlans } = await import('@/lib/memberships-seed');
    await seedMembershipPlans();
  } catch (e) { console.error('seedMembershipPlans failed', e); }
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
