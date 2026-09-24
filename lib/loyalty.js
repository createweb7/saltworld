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

export async function getLoyaltyConfig(supabase) {
  const value = await getSetting(supabase, 'loyalty');
  return {
    active: value.active !== false,
    // Wallet stores real rupees directly (redeemRate 1 = 1 "point" == ₹1) —
    // no separate loyalty-points currency. Earning is a flat credit per
    // qualifying booking, not proportional to spend: pay ₹bookingEarnThresholdInr
    // or more on a single booking → get ₹bookingEarnAmountInr added to the
    // wallet, valid for bookingEarnExpiryDays days (business rule confirmed
    // 2026-09-24, replacing the old ₹1-spent=1-point/10%-redeem model).
    redeemRate:            Number(value.redeemRate) || 1,
    maxRedeemPct:          Number(value.maxRedeemPct) || 1,     // full subtotal, admin-tunable
    bookingEarnThresholdInr: Number(value.bookingEarnThresholdInr) || 3000,
    bookingEarnAmountInr:    Number(value.bookingEarnAmountInr) || 500,
    bookingEarnExpiryDays:   Number(value.bookingEarnExpiryDays) || 45,
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
export async function postTransaction({ customerId, type, points, amountInr = null, note = '', ref = null, actorId = null, extraData = null }) {
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
    data: { balanceAfter, ...(extraData || {}) },
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

// Convenience for booking checkout — flat wallet credit once a single
// booking's total clears the threshold (not proportional to spend).
export async function awardBookingEarn({ customerId, totalInr, bookingRef }) {
  if (!customerId || !totalInr) return null;
  const supabase = getSupabase();
  const cfg = await getLoyaltyConfig(supabase);
  if (!cfg.active) return null;
  if (Number(totalInr) < cfg.bookingEarnThresholdInr) return null;
  const amount = cfg.bookingEarnAmountInr;
  if (amount <= 0) return null;
  const expiresAt = new Date(Date.now() + cfg.bookingEarnExpiryDays * 24 * 60 * 60 * 1000).toISOString();
  return postTransaction({
    customerId, type: LOYALTY_TYPES.BOOKING_EARN, points: amount, amountInr: totalInr,
    note: `₹${amount} credited on ${bookingRef} (pay ₹${cfg.bookingEarnThresholdInr}+ bookings) — expires ${new Date(expiresAt).toLocaleDateString('en-IN')}`,
    ref: bookingRef, extraData: { expiresAt },
  });
}

// Auto-expire booking-earn credits past their validity window. Each
// booking_earn transaction carries its own `data.expiresAt`; wallet_balance
// itself is one aggregate number (not itemised per-grant), so this assumes
// FIFO consumption — any spending since the grant is assumed to draw down
// older credits first — and caps the expired amount at the customer's
// current balance so it can never go negative or double-expire the same
// credit twice (`data.expiredProcessed` marks a grant as handled once,
// regardless of whether it still had balance left to expire).
// Meant to run on a schedule — see /api/cron/expire-wallet-credits.
export async function expireWalletCredits() {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { data: dueRows, error } = await supabase.from('wallet_transactions').select('*')
    .eq('type', LOYALTY_TYPES.BOOKING_EARN)
    .lt('data->>expiresAt', now);
  if (error) throw error;
  const pending = (dueRows || []).filter((r) => !r.data?.expiredProcessed);

  const byCustomer = {};
  for (const r of pending) {
    (byCustomer[r.customer_id] ||= []).push(r);
  }

  const results = [];
  for (const [customerId, rows] of Object.entries(byCustomer)) {
    const dueTotal = rows.reduce((sum, r) => sum + (r.points || 0), 0);
    const { data: cust } = await supabase.from('customers').select('wallet_balance').eq('id', customerId).maybeSingle();
    const current = Number(cust?.wallet_balance) || 0;
    const expireAmt = Math.min(current, dueTotal);
    if (expireAmt > 0) {
      await postTransaction({
        customerId, type: LOYALTY_TYPES.EXPIRY, points: -expireAmt,
        note: `₹${expireAmt} wallet credit expired (validity window passed)`, ref: null,
      });
    }
    // Mark every due grant processed regardless of the capped amount, so a
    // partially/fully-already-spent grant isn't re-evaluated on the next run.
    for (const r of rows) {
      await supabase.from('wallet_transactions').update({ data: { ...r.data, expiredProcessed: true } }).eq('id', r.id);
    }
    results.push({ customerId, expired: expireAmt });
  }
  return results;
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
