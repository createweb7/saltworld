// Loyalty wallet + referral engine.
// Both share the `walletBalance` field on customers and record every change
// via `wallet_transactions` for a full audit trail.
//
// Earning rules default:  ₹1 spent → 1 point (100 points = ₹10 credit)
// Redeem cap:              50% of any booking
// Referral defaults:       referrer 500 pts, referee 500 pts on first booking

import { randomUUID } from 'crypto';
import { getDb } from '@/lib/mongo';

export const LOYALTY_TYPES = {
  BOOKING_EARN:      'booking_earn',
  BOOKING_REDEEM:    'booking_redeem',
  REFERRAL_REWARD:   'referral_reward',
  BIRTHDAY_BONUS:    'birthday_bonus',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  REFUND:            'refund',
  EXPIRY:            'expiry',
};

async function getLoyaltyConfig(db) {
  const doc = await db.collection('settings').findOne({ key: 'loyalty' });
  return {
    active: doc?.value?.active !== false,
    earnRate:        Number(doc?.value?.earnRate) || 1,           // points per ₹1
    redeemRate:      Number(doc?.value?.redeemRate) || 0.1,        // 1 point = ₹0.1
    maxRedeemPct:    Number(doc?.value?.maxRedeemPct) || 0.5,      // 50% cap
    birthdayBonus:   Number(doc?.value?.birthdayBonus) || 500,
    expiryDays:      Number(doc?.value?.expiryDays) || 365,
  };
}

async function getReferralConfig(db) {
  const doc = await db.collection('settings').findOne({ key: 'referral' });
  return {
    active:          doc?.value?.active !== false,
    referrerReward:  Number(doc?.value?.referrerReward) || 500,
    refereeReward:   Number(doc?.value?.refereeReward)  || 500,
    minPurchase:     Number(doc?.value?.minPurchase)    || 999,
    maxReferrals:    Number(doc?.value?.maxReferrals)   || 25,
    expiryDays:      Number(doc?.value?.expiryDays)     || 90,
    codePrefix:      doc?.value?.codePrefix             || 'SW',
  };
}

// Post a wallet transaction and update the customer balance atomically.
export async function postTransaction({ customerId, type, points, amountInr = null, note = '', ref = null, actorId = null }) {
  if (!customerId || !type || typeof points !== 'number') throw new Error('missing_fields');
  const db = await getDb();
  const now = new Date().toISOString();
  const tx = {
    id: randomUUID(),
    customerId, type,
    points,                     // positive = credit, negative = debit
    amountInr,                  // ₹ value of this movement (positive both ways)
    balanceAfter: null,          // filled below
    note, ref,
    actorId,
    createdAt: now,
  };
  const customer = await db.collection('customers').findOne({ id: customerId });
  const balanceBefore = Number(customer?.walletBalance) || 0;
  const balanceAfter = balanceBefore + points;
  if (balanceAfter < 0) throw new Error('insufficient_balance');
  tx.balanceAfter = balanceAfter;
  await db.collection('customers').updateOne({ id: customerId }, { $set: { walletBalance: balanceAfter, lastWalletActivityAt: now } });
  await db.collection('wallet_transactions').insertOne({ ...tx });
  return tx;
}

export async function customerBalance(customerId) {
  const db = await getDb();
  const c = await db.collection('customers').findOne({ id: customerId });
  return Number(c?.walletBalance) || 0;
}

export async function customerHistory(customerId, limit = 50) {
  const db = await getDb();
  const docs = await db.collection('wallet_transactions').find({ customerId }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

// Convenience for booking checkout — award earn points.
export async function awardBookingEarn({ customerId, totalInr, bookingRef }) {
  if (!customerId || !totalInr) return null;
  const db = await getDb();
  const cfg = await getLoyaltyConfig(db);
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

export async function issueReferralCode(customerId) {
  const db = await getDb();
  const existing = await db.collection('referral_codes').findOne({ customerId, active: true });
  if (existing) { const { _id, ...rest } = existing; return rest; }
  const cfg = await getReferralConfig(db);
  const now = new Date().toISOString();
  let code, tries = 0;
  do {
    code = genReferralCode(cfg.codePrefix);
    tries++;
    if (tries > 20) throw new Error('code_generation_failed');
  } while (await db.collection('referral_codes').findOne({ code }));
  const doc = {
    id: randomUUID(),
    customerId, code,
    referrerReward: cfg.referrerReward,
    refereeReward:  cfg.refereeReward,
    minPurchase:    cfg.minPurchase,
    active: true,
    usageCount: 0,
    createdAt: now,
  };
  await db.collection('referral_codes').insertOne(doc);
  return doc;
}

// Called during booking POST when a referral code is present.
// Awards both parties on the *first* qualifying booking of the referee.
export async function applyReferralOnBooking({ code, bookingRef, bookingCustomerId, totalInr }) {
  if (!code || !bookingCustomerId) return { applied: false, reason: 'missing_fields' };
  const db = await getDb();
  const cfg = await getReferralConfig(db);
  if (!cfg.active) return { applied: false, reason: 'referrals_disabled' };
  const c = await db.collection('referral_codes').findOne({ code: code.toUpperCase(), active: true });
  if (!c) return { applied: false, reason: 'invalid_code' };
  if (c.customerId === bookingCustomerId) return { applied: false, reason: 'self_referral' };
  if (Number(totalInr) < cfg.minPurchase) return { applied: false, reason: 'below_min_purchase' };

  // Only the first booking by this referee against this code counts.
  const already = await db.collection('referrals').findOne({ codeId: c.id, refereeCustomerId: bookingCustomerId });
  if (already) return { applied: false, reason: 'already_used' };
  if ((c.usageCount || 0) >= cfg.maxReferrals) return { applied: false, reason: 'code_maxed' };

  const now = new Date().toISOString();
  await db.collection('referrals').insertOne({
    id: randomUUID(),
    codeId: c.id, code: c.code,
    referrerCustomerId: c.customerId,
    refereeCustomerId: bookingCustomerId,
    bookingRef, totalInr,
    referrerReward: c.referrerReward,
    refereeReward:  c.refereeReward,
    status: 'rewarded',
    createdAt: now,
  });
  await db.collection('referral_codes').updateOne({ id: c.id }, { $inc: { usageCount: 1 } });

  await postTransaction({ customerId: c.customerId,      type: LOYALTY_TYPES.REFERRAL_REWARD, points: c.referrerReward, note: `Referral bonus — ${bookingRef}`, ref: bookingRef });
  await postTransaction({ customerId: bookingCustomerId, type: LOYALTY_TYPES.REFERRAL_REWARD, points: c.refereeReward,  note: `Welcome bonus — ${c.code}`,       ref: bookingRef });

  return { applied: true, referrer: c.customerId, referrerReward: c.referrerReward, refereeReward: c.refereeReward };
}

export async function referralStats(customerId) {
  const db = await getDb();
  const code = await db.collection('referral_codes').findOne({ customerId, active: true });
  const referrals = code ? await db.collection('referrals').find({ codeId: code.id }).sort({ createdAt: -1 }).toArray() : [];
  const totalEarned = referrals.reduce((sum, r) => sum + Number(r.referrerReward || 0), 0);
  const revenue = referrals.reduce((sum, r) => sum + Number(r.totalInr || 0), 0);
  return {
    code: code ? { code: code.code, usageCount: code.usageCount, referrerReward: code.referrerReward, refereeReward: code.refereeReward } : null,
    referrals: referrals.map(({ _id, ...rest }) => rest),
    totalEarned, revenue,
  };
}

export async function topReferrers({ limit = 10 } = {}) {
  const db = await getDb();
  const agg = await db.collection('referrals').aggregate([
    { $group: { _id: '$referrerCustomerId', count: { $sum: 1 }, revenue: { $sum: '$totalInr' }, rewards: { $sum: '$referrerReward' } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]).toArray();
  const enriched = [];
  for (const a of agg) {
    const c = await db.collection('customers').findOne({ id: a._id });
    enriched.push({ customerId: a._id, name: c?.name || '—', phone: c?.phone || '', count: a.count, revenue: a.revenue, rewards: a.rewards });
  }
  return enriched;
}
