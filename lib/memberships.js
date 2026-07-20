// Salt World — Membership & Subscription Engine
//
// One centralized library. All membership logic (validation, consumption,
// ledger, freeze/extend) lives here. Consumed by:
//   • Admin CRUD                (grant, freeze, extend)
//   • Public purchase flow      (online + offline)
//   • Booking engine            (auto-apply on POST /api/bookings)
//   • Customer + admin portals  (read models)
//
// Data model
// ----------
// memberships          — plans (product configuration)
// memberSubscriptions  — a purchased instance of a plan
// membership_usage     — one row per booking consumed
// membership_transactions — full audit ledger (purchased/consumed/frozen/extended/adjusted)
//
// Snapshotting: on purchase, the plan is copied into subscription.planSnapshot
// so that a mid-flight plan edit does not retroactively change a customer's
// benefits.

import { randomUUID } from 'crypto';
import { getDb } from '@/lib/mongo';

// ---------- shape helpers ----------

export const MEMBERSHIP_TYPES = ['sessions', 'unlimited', 'wallet', 'corporate', 'family', 'trial'];
export const BILLING_CYCLES = ['one_time', 'monthly', 'quarterly', 'halfyearly', 'yearly'];

export function normalizePlan(input) {
  // Ensures every plan doc has a complete field set; defaults everything.
  return {
    id: input.id || randomUUID(),
    name:  input.name  || '',
    slug:  input.slug  || slugify(input.name),
    code:  input.code  || '',
    type:  MEMBERSHIP_TYPES.includes(input.type) ? input.type : 'sessions',
    description: input.description || '',
    price: Number(input.price) || 0,
    gstPercent: Number(input.gstPercent) || 18,
    billingCycle: BILLING_CYCLES.includes(input.billingCycle) ? input.billingCycle : 'one_time',
    validityDays: Number(input.validityDays) || 30,
    startsOnFirstVisit: Boolean(input.startsOnFirstVisit),
    sessionsIncluded: Number(input.sessionsIncluded) || 0,
    walletCredit:     Number(input.walletCredit)     || 0,
    dailyUsageLimit:   Number(input.dailyUsageLimit)   || 0,   // 0 = unlimited
    weeklyUsageLimit:  Number(input.weeklyUsageLimit)  || 0,
    monthlyUsageLimit: Number(input.monthlyUsageLimit) || 0,
    cooldownMin:       Number(input.cooldownMin)       || 0,
    advanceBookingDays: Number(input.advanceBookingDays) || 30,
    applicableTherapies: Array.isArray(input.applicableTherapies) ? input.applicableTherapies : [],
    applicableBranches:  Array.isArray(input.applicableBranches)  ? input.applicableBranches  : [],
    benefits: Array.isArray(input.benefits) ? input.benefits : [], // [{code, label, config?}]
    freezeAllowed:    input.freezeAllowed    !== false,
    pauseAllowed:     input.pauseAllowed     !== false,
    transferAllowed:  Boolean(input.transferAllowed),
    giftable:         input.giftable         !== false,
    autoRenew:        Boolean(input.autoRenew),
    refundPolicy: input.refundPolicy || 'no_refund',
    active: input.active !== false,
    heroImage: input.heroImage || '',
    order: Number(input.order) || 100,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
}

// ---------- ledger ----------

export async function logTransaction(db, { subscriptionId, customerId, type, note, amount = 0, actorId = null, meta = null }) {
  const doc = {
    id: randomUUID(),
    subscriptionId,
    customerId,
    type,          // 'purchase' | 'consume' | 'freeze' | 'unfreeze' | 'extend' | 'adjust' | 'refund' | 'cancel' | 'renew'
    note: note || null,
    amount,        // ₹ for money-linked events, or session-delta for adjustments
    actorId,
    meta: meta || null,
    createdAt: new Date().toISOString(),
  };
  await db.collection('membership_transactions').insertOne(doc);
  return doc;
}

// ---------- purchase / grant ----------

/**
 * Create a customer subscription. Copies plan into subscription.planSnapshot.
 *
 * @param {Object} args
 *   customerId, planId (plan doc id), payment: {method:'online'|'offline'|'complimentary', ref?}, actorId?
 */
export async function grantSubscription({ customerId, planId, payment = { method: 'offline' }, actorId = null, startAt = null }) {
  const db = await getDb();
  const plan = await db.collection('memberships').findOne({ id: planId });
  if (!plan) throw new Error('plan_not_found');
  const now = startAt ? new Date(startAt) : new Date();
  const end = new Date(now); end.setDate(end.getDate() + (plan.validityDays || 30));
  const snapshot = normalizePlan(plan);
  const doc = {
    id: randomUUID(),
    customerId,
    planId: plan.id,
    planName: snapshot.name,
    planSnapshot: snapshot,
    status: 'active',
    startAt: now.toISOString(),
    endAt: end.toISOString(),
    sessionsIncluded: snapshot.sessionsIncluded,
    sessionsUsed: 0,
    sessionsRemaining: snapshot.sessionsIncluded,
    walletBalance: snapshot.walletCredit,
    payment: { method: payment.method, ref: payment.ref || null, amount: snapshot.price },
    freezeHistory: [],
    createdAt: new Date().toISOString(),
  };
  await db.collection('memberSubscriptions').insertOne(doc);
  await logTransaction(db, {
    subscriptionId: doc.id, customerId, type: 'purchase',
    amount: snapshot.price, actorId,
    note: `Purchased "${snapshot.name}" via ${payment.method}`,
    meta: { paymentRef: payment.ref || null },
  });
  const { _id, ...rest } = doc;
  return rest;
}

// ---------- consumption logic (called by booking engine) ----------

/**
 * Find best-matching active subscription for a customer for a given therapy/branch.
 * Returns the eligible subscription doc, or null.
 *
 * Best match ranking:
 *   1. Type=sessions with fewest remaining that still covers (use up first)
 *   2. Type=unlimited (spread daily quota)
 */
export async function findEligibleSubscription({ customerId, therapySlug, branchId, atIso }) {
  if (!customerId) return null;
  const db = await getDb();
  const now = atIso ? new Date(atIso) : new Date();
  const active = await db.collection('memberSubscriptions').find({
    customerId,
    status: 'active',
    startAt: { $lte: now.toISOString() },
    endAt:   { $gte: now.toISOString() },
  }).toArray();
  const eligible = [];
  for (const sub of active) {
    const check = await validateForBooking({ subscription: sub, therapySlug, branchId, atIso });
    if (check.ok) eligible.push(sub);
  }
  if (eligible.length === 0) return null;
  // Prefer sessions with fewest remaining; then unlimited by earliest endAt.
  eligible.sort((a, b) => {
    const at = a.planSnapshot?.type || 'sessions';
    const bt = b.planSnapshot?.type || 'sessions';
    if (at === 'sessions' && bt !== 'sessions') return -1;
    if (at !== 'sessions' && bt === 'sessions') return 1;
    if (at === 'sessions') return (a.sessionsRemaining || 0) - (b.sessionsRemaining || 0);
    return new Date(a.endAt) - new Date(b.endAt);
  });
  const { _id, ...rest } = eligible[0];
  return rest;
}

export async function validateForBooking({ subscription, therapySlug, branchId, atIso }) {
  const now = atIso ? new Date(atIso) : new Date();
  const plan = subscription.planSnapshot || {};

  if (subscription.status !== 'active') return { ok: false, reason: 'subscription_not_active' };
  if (new Date(subscription.endAt) < now) return { ok: false, reason: 'subscription_expired' };
  if (new Date(subscription.startAt) > now) return { ok: false, reason: 'subscription_not_started' };

  // Therapy coverage: empty applicable list means "all"
  if (Array.isArray(plan.applicableTherapies) && plan.applicableTherapies.length > 0) {
    if (!plan.applicableTherapies.includes(therapySlug)) return { ok: false, reason: 'therapy_not_covered' };
  }
  // Branch coverage: empty applicable list means "all"
  if (Array.isArray(plan.applicableBranches) && plan.applicableBranches.length > 0) {
    if (branchId && !plan.applicableBranches.includes(branchId)) return { ok: false, reason: 'branch_not_covered' };
  }

  // Type-specific
  if (plan.type === 'sessions') {
    if ((subscription.sessionsRemaining || 0) <= 0) return { ok: false, reason: 'no_sessions_remaining' };
  }

  // Usage caps — count consumption in the relevant window.
  const db = await getDb();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  if (plan.dailyUsageLimit > 0) {
    const usedToday = await db.collection('membership_usage').countDocuments({
      subscriptionId: subscription.id, consumedAt: { $gte: dayStart.toISOString() },
    });
    if (usedToday >= plan.dailyUsageLimit) return { ok: false, reason: 'daily_limit_reached' };
  }
  if (plan.weeklyUsageLimit > 0) {
    const usedWeek = await db.collection('membership_usage').countDocuments({
      subscriptionId: subscription.id, consumedAt: { $gte: weekStart.toISOString() },
    });
    if (usedWeek >= plan.weeklyUsageLimit) return { ok: false, reason: 'weekly_limit_reached' };
  }
  if (plan.monthlyUsageLimit > 0) {
    const usedMonth = await db.collection('membership_usage').countDocuments({
      subscriptionId: subscription.id, consumedAt: { $gte: monthStart.toISOString() },
    });
    if (usedMonth >= plan.monthlyUsageLimit) return { ok: false, reason: 'monthly_limit_reached' };
  }

  // Cooldown between consecutive uses.
  if (plan.cooldownMin > 0) {
    const cutoff = new Date(now.getTime() - plan.cooldownMin * 60000);
    const recent = await db.collection('membership_usage').findOne({
      subscriptionId: subscription.id, consumedAt: { $gt: cutoff.toISOString() },
    });
    if (recent) return { ok: false, reason: 'cooldown_active' };
  }
  return { ok: true };
}

/**
 * Consume one session from a subscription for a booking.
 * Called by the booking engine. Idempotent-ish: writes a usage row and decrements sessions.
 * Returns updated subscription doc.
 */
export async function consumeForBooking({ subscription, bookingId, therapySlug, branchId, atIso, actorId = null }) {
  const db = await getDb();
  const usage = {
    id: randomUUID(),
    subscriptionId: subscription.id,
    customerId:     subscription.customerId,
    bookingId,
    therapySlug: therapySlug || null,
    branchId:    branchId    || null,
    consumedAt:  atIso || new Date().toISOString(),
  };
  await db.collection('membership_usage').insertOne(usage);

  const $inc = {};
  const plan = subscription.planSnapshot || {};
  if (plan.type === 'sessions') {
    $inc.sessionsUsed = 1;
    $inc.sessionsRemaining = -1;
  }
  await db.collection('memberSubscriptions').updateOne({ id: subscription.id }, { $inc });
  const updated = await db.collection('memberSubscriptions').findOne({ id: subscription.id });

  await logTransaction(db, {
    subscriptionId: subscription.id, customerId: subscription.customerId, type: 'consume', actorId,
    note: `Session consumed for booking ${bookingId} (${therapySlug || 'unspecified'})`,
    meta: { bookingId, therapySlug, branchId },
  });
  const { _id, ...rest } = updated;
  return rest;
}

// ---------- freeze / unfreeze / extend / adjust ----------

export async function freezeSubscription({ subscriptionId, actorId, reason }) {
  const db = await getDb();
  const before = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  if (!before) throw new Error('not_found');
  if (!before.planSnapshot?.freezeAllowed) throw new Error('freeze_not_allowed');
  const now = new Date().toISOString();
  await db.collection('memberSubscriptions').updateOne(
    { id: subscriptionId },
    { $set: { status: 'frozen', frozenAt: now }, $push: { freezeHistory: { at: now, by: actorId, reason: reason || null } } },
  );
  await logTransaction(db, { subscriptionId, customerId: before.customerId, type: 'freeze', actorId, note: reason || 'Frozen' });
  const after = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  const { _id, ...rest } = after;
  return rest;
}

export async function unfreezeSubscription({ subscriptionId, actorId }) {
  const db = await getDb();
  const before = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  if (!before) throw new Error('not_found');
  if (before.status !== 'frozen') throw new Error('not_frozen');
  // Extend endAt by the frozen duration.
  const frozenSince = before.frozenAt ? new Date(before.frozenAt) : null;
  const now = new Date();
  const extraMs = frozenSince ? now.getTime() - frozenSince.getTime() : 0;
  const newEnd = new Date(new Date(before.endAt).getTime() + extraMs).toISOString();
  await db.collection('memberSubscriptions').updateOne(
    { id: subscriptionId },
    { $set: { status: 'active', frozenAt: null, endAt: newEnd } },
  );
  await logTransaction(db, {
    subscriptionId, customerId: before.customerId, type: 'unfreeze', actorId,
    note: `Unfrozen; validity extended by ${Math.round(extraMs / 86400000)} days`,
  });
  const after = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  const { _id, ...rest } = after;
  return rest;
}

export async function extendSubscription({ subscriptionId, days, actorId, note }) {
  const db = await getDb();
  const before = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  if (!before) throw new Error('not_found');
  const newEnd = new Date(new Date(before.endAt).getTime() + Number(days) * 86400000).toISOString();
  await db.collection('memberSubscriptions').updateOne({ id: subscriptionId }, { $set: { endAt: newEnd } });
  await logTransaction(db, {
    subscriptionId, customerId: before.customerId, type: 'extend', actorId,
    amount: Number(days), note: note || `Validity extended by ${days} days`,
  });
  const after = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  const { _id, ...rest } = after;
  return rest;
}

export async function adjustSubscription({ subscriptionId, sessionsDelta = 0, walletDelta = 0, actorId, note }) {
  const db = await getDb();
  const before = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  if (!before) throw new Error('not_found');
  const $inc = {};
  if (sessionsDelta) $inc.sessionsRemaining = Number(sessionsDelta);
  if (walletDelta)   $inc.walletBalance     = Number(walletDelta);
  if (Object.keys($inc).length === 0) throw new Error('nothing_to_adjust');
  await db.collection('memberSubscriptions').updateOne({ id: subscriptionId }, { $inc });
  await logTransaction(db, {
    subscriptionId, customerId: before.customerId, type: 'adjust', actorId,
    amount: sessionsDelta || walletDelta, note: note || 'Manual adjustment',
    meta: { sessionsDelta, walletDelta },
  });
  const after = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  const { _id, ...rest } = after;
  return rest;
}

export async function cancelSubscription({ subscriptionId, actorId, reason }) {
  const db = await getDb();
  const before = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  if (!before) throw new Error('not_found');
  await db.collection('memberSubscriptions').updateOne({ id: subscriptionId }, { $set: { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: reason || null } });
  await logTransaction(db, { subscriptionId, customerId: before.customerId, type: 'cancel', actorId, note: reason || 'Cancelled' });
  const after = await db.collection('memberSubscriptions').findOne({ id: subscriptionId });
  const { _id, ...rest } = after;
  return rest;
}

// ---------- daily maintenance (call from a cron / worker later) ----------

export async function expireSubscriptions() {
  const db = await getDb();
  const now = new Date().toISOString();
  const r = await db.collection('memberSubscriptions').updateMany(
    { status: 'active', endAt: { $lt: now } },
    { $set: { status: 'expired' } },
  );
  return { expired: r.modifiedCount };
}
