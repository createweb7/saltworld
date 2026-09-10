// Salt World BOS — seed the default super admin on first admin route hit.
// Idempotent. Safe to call from route handlers.
//
// Indexes/constraints (unique emails, etc.) now live in the Postgres schema
// itself (supabase/schema.sql) rather than being created here at runtime.

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { seedSystemTherapies } from '@/lib/therapies-seed';

let _seeded = false;

export async function ensureSeed() {
  if (_seeded) return;
  const supabase = getSupabase();

  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
  if (!count) {
    const email = process.env.ADMIN_SEED_EMAIL || 'admin@saltworld.in';
    const password = process.env.ADMIN_SEED_PASSWORD || 'SaltWorld@2025';
    const passwordHash = await bcrypt.hash(password, 10);
    await supabase.from('users').insert({
      id: randomUUID(), email: email.toLowerCase(), name: 'Salt World Admin', password_hash: passwordHash,
      role: 'super_admin', permissions: [], status: 'active',
      created_at: new Date().toISOString(), last_login_at: null,
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
