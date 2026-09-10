// Seed a handful of Salt World starter plans matching real pricing.
// Idempotent — upserts by slug. Marks isSystem for reference.

import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { normalizePlan } from '@/lib/memberships';

const SEEDS = [
  // Salt Cave unlimited memberships (flyer prices)
  { slug: 'salt-cave-1m',  name: 'Salt Cave · 1 Month',  type: 'unlimited', price: 16000,  gstPercent: 18, validityDays: 30,  dailyUsageLimit: 1, applicableTherapies: ['salt-therapy'],  order: 10, description: 'Unlimited daily halotherapy sessions for 30 days.' },
  { slug: 'salt-cave-3m',  name: 'Salt Cave · 3 Months', type: 'unlimited', price: 42000,  gstPercent: 18, validityDays: 90,  dailyUsageLimit: 1, applicableTherapies: ['salt-therapy'],  order: 11, description: 'Three months of unlimited daily halotherapy.' },
  { slug: 'salt-cave-6m',  name: 'Salt Cave · 6 Months', type: 'unlimited', price: 72000,  gstPercent: 18, validityDays: 180, dailyUsageLimit: 1, applicableTherapies: ['salt-therapy'],  order: 12, description: 'Six months of unlimited daily halotherapy — our most popular plan.' },
  { slug: 'salt-cave-1y',  name: 'Salt Cave · 1 Year',   type: 'unlimited', price: 120000, gstPercent: 18, validityDays: 365, dailyUsageLimit: 1, applicableTherapies: ['salt-therapy'],  order: 13, description: 'A full year of daily halotherapy access.' },

  // Session packages
  { slug: 'float-4pack',   name: 'Float · 4-Session Pack',       type: 'sessions', price: 8996,  gstPercent: 18, validityDays: 90,  sessionsIncluded: 4,  applicableTherapies: ['float-therapy'],  order: 20, description: 'Four sixty-minute float sessions. Valid for ninety days.' },
  { slug: 'float-8pack',   name: 'Float · 8-Session Pack',       type: 'sessions', price: 16992, gstPercent: 18, validityDays: 180, sessionsIncluded: 8,  applicableTherapies: ['float-therapy'],  order: 21, description: 'Eight float sessions with a bonus discount. Valid six months.' },
  { slug: 'recovery-8',    name: 'Recovery Pack (Sauna + Cold)', type: 'sessions', price: 15000, gstPercent: 18, validityDays: 180, sessionsIncluded: 8,  applicableTherapies: ['infrared-sauna', 'cold-plunge'], order: 30, description: 'Contrast therapy — 8 sessions across sauna and cold plunge.' },
  { slug: 'premium-12',    name: 'Premium Wellness · 12 Pack',   type: 'sessions', price: 22000, gstPercent: 18, validityDays: 180, sessionsIncluded: 12, applicableTherapies: [], order: 40, description: 'Twelve sessions redeemable on any therapy. Six-month validity.' },
];

export async function seedMembershipPlans() {
  const supabase = getSupabase();
  for (const seed of SEEDS) {
    const { data: existing } = await supabase.from('memberships').select('id').eq('slug', seed.slug).maybeSingle();
    if (existing) continue;
    const doc = normalizePlan({ ...seed, id: randomUUID() });
    const { name, slug, active, createdAt, updatedAt, id, ...plan } = doc;
    await supabase.from('memberships').insert({
      id, slug, name, active, plan, created_at: createdAt, updated_at: updatedAt,
    });
  }
}
