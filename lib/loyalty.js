// Loyalty wallet + referral engine.
// Both share the `walletBalance` field on customers and record every change
// via `wallet_transactions` for a full audit trail.
//
// Earning rules default:  ₹1 spent → 1 point (100 points = ₹10 credit)
// Redeem cap:              full subtotal of any booking (admin-tunable)
// Referral defaults:       referrer 500 pts, referee 500 pts on first booking

import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';

export const LOYALTY_TYPES = {
  BOOKING_EARN:      'booking_earn',
  BOOKING_REDEEM:    'booking_redeem',
  REFERRAL_REWARD:   'referral_reward',
  BIRTHDAY_BONUS:    'birthday_bonus',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  REFUND:            'refund',
  EXPIRY:            'expiry',
};

async function getSetting(supabase, key) {
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  return row?.value || {};
}

async function getLoyaltyConfig(supabase) {
  const value = await getSetting(supabase, 'loyalty');
  return {
    active: value.active !== false,
    earnRate:        Number(value.earnRate) || 1,           // points per ₹1
    redeemRate:      Number(value.redeemRate) || 0.1,        // 1 point = ₹0.1
    maxRedeemPct:    Number(value.maxRedeemPct) || 1,        // full subtotal, admin-tunable
    birthdayBonus:   Number(value.birthdayBonus) || 500,
    expiryDays:      Number(value.expiryDays) || 365,
  };
}

async function getReferralConfig(supabase) {
  const value = await getSetting(supabase, 'referral');
  return {
    active:          value.active !== false,
    referrerReward:  Number(value.referrerReward) || 500,
    refereeReward:   Number(value.refereeReward)  || 500,
    minPurchase:     Number(value.minPurchase)    || 999,
    maxReferrals:    Number(value.maxReferrals)   || 25,
    expiryDays:      Number(value.expiryDays)     || 90,
    codePrefix:      value.codePrefix             || 'SW',
  };
}

// Post a wallet transaction and update the customer balance atomically.
// Uses a single conditional UPDATE (balance + points >= 0) rather than the
// old Mongo find-then-updateOne pair, which closes a real race window the
// original code had (two concurrent redemptions could both read the same
// starting balance).
export async function postTransaction({ customerId, type, points, amountInr = null, note = '', ref = null, actorId = null }) {
  if (!customerId || !type || typeof points !== 'number') throw new Error('missing_fields');
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase.rpc('adjust_wallet_balance', {
    p_customer_id: customerId, p_points: points, p_now: now,
  });
  if (error) throw error;
  if (updated == null) throw new Error('insufficient_balance');
  const balanceAfter = updated;

  const tx = {
    id: randomUUID(), customer_id: customerId, type, points, amount_inr: amountInr,
    note, ref, actor_id: actorId, created_at: now,
    data: { balanceAfter },
  };
  const { error: txErr } = await supabase.from('wallet_transactions').insert(tx);
  if (txErr) throw txErr;
  return { id: tx.id, customerId, type, points, amountInr, balanceAfter, note, ref, actorId, createdAt: now };
}

export async function customerBalance(customerId) {
  const supabase = getSupabase();
  const { data: c } = await supabase.from('customers').select('wallet_balance').eq('id', customerId).maybeSingle();
  return Number(c?.wallet_balance) || 0;
}

export async function customerHistory(customerId, limit = 50) {
  const supabase = getSupabase();
  const { data: rows } = await supabase.from('wallet_transactions').select('*')
    .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(limit);
  return (rows || []).map((r) => ({
    ...r.data, id: r.id, customerId: r.customer_id, type: r.type, points: r.points,
    amountInr: r.amount_inr, note: r.note, ref: r.ref, actorId: r.actor_id, createdAt: r.created_at,
  }));
}

// Convenience for booking checkout — award earn points.
export async function awardBookingEarn({ customerId, totalInr, bookingRef }) {
  if (!customerId || !totalInr) return null;
  const supabase = getSupabase();
  const cfg = await getLoyaltyConfig(supabase);
  if (!cfg.active) return null;
  const points = Math.floor(Number(totalInr) * cfg.earnRate);
  if (points <= 0) return null;
  return postTransaction({ customerId, type: LOYALTY_TYPES.BOOKING_EARN, points, amountInr: totalInr, note: `Earned on ${bookingRef}`, ref: bookingRef });
}

// -------- Referrals --------

function genReferralCode(prefix = 'SW') {
  const rand = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  return `${prefix}${rand}`;
}

function toReferralCode(row) {
  if (!row) return null;
  const { data, ...c } = row;
  return {
    ...data, id: c.id, customerId: c.customer_id, code: c.code,
    usageCount: c.usage_count, createdAt: c.created_at,
  };
}

export async function issueReferralCode(customerId) {
  const supabase = getSupabase();
  const { data: existingRow } = await supabase.from('referral_codes').select('*').eq('customer_id', customerId).maybeSingle();
  if (existingRow) return toReferralCode(existingRow);
  const cfg = await getReferralConfig(supabase);
  const now = new Date().toISOString();
  let code, tries = 0;
  for (;;) {
    code = genReferralCode(cfg.codePrefix);
    tries++;
    if (tries > 20) throw new Error('code_generation_failed');
    const { data: clash } = await supabase.from('referral_codes').select('id').eq('code', code).maybeSingle();
    if (!clash) break;
  }
  const row = {
    id: randomUUID(), customer_id: customerId, code, usage_count: 0, created_at: now,
    data: { referrerReward: cfg.referrerReward, refereeReward: cfg.refereeReward, minPurchase: cfg.minPurchase, active: true },
  };
  const { error } = await supabase.from('referral_codes').insert(row);
  if (error) throw error;
  return toReferralCode(row);
}

// Called during booking POST when a referral code is present.
// Awards both parties on the *first* qualifying booking of the referee.
export async function applyReferralOnBooking({ code, bookingRef, bookingCustomerId, totalInr }) {
  if (!code || !bookingCustomerId) return { applied: false, reason: 'missing_fields' };
  const supabase = getSupabase();
  const cfg = await getReferralConfig(supabase);
  if (!cfg.active) return { applied: false, reason: 'referrals_disabled' };
  const { data: row } = await supabase.from('referral_codes').select('*').eq('code', code.toUpperCase()).maybeSingle();
  const c = toReferralCode(row);
  if (!c || c.active === false) return { applied: false, reason: 'invalid_code' };
  if (c.customerId === bookingCustomerId) return { applied: false, reason: 'self_referral' };
  if (Number(totalInr) < cfg.minPurchase) return { applied: false, reason: 'below_min_purchase' };

  // Only the first booking by this referee against this code counts.
  const { data: already } = await supabase.from('referrals').select('id')
    .eq('referral_code_id', c.id).eq('referred_customer_id', bookingCustomerId).maybeSingle();
  if (already) return { applied: false, reason: 'already_used' };
  if ((c.usageCount || 0) >= cfg.maxReferrals) return { applied: false, reason: 'code_maxed' };

  const now = new Date().toISOString();
  const referrerReward = c.referrerReward ?? cfg.referrerReward;
  const refereeReward = c.refereeReward ?? cfg.refereeReward;
  const { error } = await supabase.from('referrals').insert({
    id: randomUUID(), referral_code_id: c.id, referrer_customer_id: c.customerId,
    referred_customer_id: bookingCustomerId, total_inr: totalInr || 0, referrer_reward: referrerReward,
    status: 'rewarded', created_at: now,
    data: { code: c.code, bookingRef, refereeReward },
  });
  if (error) throw error;
  await supabase.from('referral_codes').update({ usage_count: (c.usageCount || 0) + 1 }).eq('id', c.id);

  await postTransaction({ customerId: c.customerId,      type: LOYALTY_TYPES.REFERRAL_REWARD, points: referrerReward, note: `Referral bonus — ${bookingRef}`, ref: bookingRef });
  await postTransaction({ customerId: bookingCustomerId, type: LOYALTY_TYPES.REFERRAL_REWARD, points: refereeReward,  note: `Welcome bonus — ${c.code}`,       ref: bookingRef });

  return { applied: true, referrer: c.customerId, referrerReward, refereeReward };
}

export async function referralStats(customerId) {
  const supabase = getSupabase();
  const { data: codeRow } = await supabase.from('referral_codes').select('*').eq('customer_id', customerId).maybeSingle();
  const code = toReferralCode(codeRow);
  const { data: refRows } = code
    ? await supabase.from('referrals').select('*').eq('referral_code_id', code.id).order('created_at', { ascending: false })
    : { data: [] };
  const referrals = (refRows || []).map((r) => ({
    ...r.data, id: r.id, referralCodeId: r.referral_code_id, referrerCustomerId: r.referrer_customer_id,
    refereeCustomerId: r.referred_customer_id, totalInr: r.total_inr, referrerReward: r.referrer_reward,
    status: r.status, createdAt: r.created_at,
  }));
  const totalEarned = referrals.reduce((sum, r) => sum + Number(r.referrerReward || 0), 0);
  const revenue = referrals.reduce((sum, r) => sum + Number(r.totalInr || 0), 0);
  return {
    code: code ? { code: code.code, usageCount: code.usageCount, referrerReward: code.referrerReward, refereeReward: code.refereeReward } : null,
    referrals, totalEarned, revenue,
  };
}

export async function topReferrers({ limit = 10 } = {}) {
  const supabase = getSupabase();
  const { data: refRows } = await supabase.from('referrals').select('referrer_customer_id, total_inr, referrer_reward');
  const byReferrer = new Map();
  for (const r of refRows || []) {
    const id = r.referrer_customer_id;
    if (!id) continue;
    const cur = byReferrer.get(id) || { count: 0, revenue: 0, rewards: 0 };
    cur.count += 1;
    cur.revenue += Number(r.total_inr || 0);
    cur.rewards += Number(r.referrer_reward || 0);
    byReferrer.set(id, cur);
  }
  const top = [...byReferrer.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit);
  const enriched = [];
  for (const [customerId, agg] of top) {
    const { data: c } = await supabase.from('customers').select('name, phone').eq('id', customerId).maybeSingle();
    enriched.push({ customerId, name: c?.name || '—', phone: c?.phone || '', ...agg });
  }
  return enriched;
}
