// Multi-branch support — helpers to load, resolve and scope by branch.
// Every mutable entity should carry a branchId. Legacy rows without a branchId
// are treated as belonging to the default (first active) branch so nothing breaks.

import { getSupabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

const BRANCH_COOKIE = 'sw_branch';
const SEED_TIMEZONE = 'Asia/Kolkata';

// Maps a `branches` row (explicit columns + `data` catch-all) back to the
// camelCase shape the rest of the app expects — unchanged from the Mongo era.
function toBranch(row) {
  if (!row) return null;
  const { data, ...cols } = row;
  return {
    ...data,
    id: cols.id,
    name: cols.name,
    code: cols.code,
    isDefault: cols.is_default,
    hours: cols.hours,
    createdAt: cols.created_at,
    updatedAt: cols.updated_at,
  };
}

async function seedDefaultBranch(supabase) {
  const now = new Date().toISOString();
  const hours = {
    monday:    { open: true, from: '06:00', to: '21:00' },
    tuesday:   { open: true, from: '06:00', to: '21:00' },
    wednesday: { open: true, from: '06:00', to: '21:00' },
    thursday:  { open: true, from: '06:00', to: '21:00' },
    friday:    { open: true, from: '06:00', to: '21:00' },
    saturday:  { open: true, from: '07:00', to: '21:00' },
    sunday:    { open: true, from: '07:00', to: '20:00' },
  };
  const row = {
    id: randomUUID(),
    code: 'HSR',
    name: 'HSR Layout',
    is_default: true,
    hours,
    data: {
      address: 'Site 1, 2nd floor, 18th Main, HSR Layout, Sector 3, Bengaluru 560102',
      phone: '+917687878793', whatsapp: '917687878793', email: 'info@saltworld.in',
      timezone: SEED_TIMEZONE, currency: 'INR', status: 'active', holidays: [],
    },
    created_at: now, updated_at: now,
  };
  const { data: inserted, error } = await supabase.from('branches').insert(row).select().single();
  if (error) throw error;
  return toBranch(inserted);
}

export async function getBranches({ activeOnly = false } = {}) {
  const supabase = getSupabase();
  let query = supabase.from('branches').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: true });
  const { data: rows, error } = await query;
  if (error) throw error;
  let branches = rows.map(toBranch);
  if (activeOnly) branches = branches.filter((b) => (b.status || 'active') === 'active');
  if (branches.length === 0) {
    branches = [await seedDefaultBranch(supabase)];
  }
  return branches;
}

export async function getDefaultBranch() {
  const all = await getBranches();
  return all.find((b) => b.isDefault) || all[0] || null;
}

export async function getBranchById(id) {
  if (!id) return null;
  const supabase = getSupabase();
  const { data: row } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
  return toBranch(row);
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
