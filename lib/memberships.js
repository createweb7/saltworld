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
// member_subscriptions — a purchased instance of a plan
// membership_usage     — one row per booking consumed
// membership_transactions — full audit ledger (purchased/consumed/frozen/extended/adjusted)
//
// Snapshotting: on purchase, the plan is copied into subscription.planSnapshot
// so that a mid-flight plan edit does not retroactively change a customer's
// benefits.

import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { toSubscription } from '@/lib/db-mappers';

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

function toMembership(row) {
  if (!row) return null;
  const { plan, ...m } = row;
  return { ...plan, id: m.id, slug: m.slug, name: m.name, active: m.active, createdAt: m.created_at, updatedAt: m.updated_at };
}

async function getSub(supabase, id) {
  const { data: row } = await supabase.from('member_subscriptions').select('*').eq('id', id).maybeSingle();
  return toSubscription(row);
}

// `toSubscription` flattens the `data` jsonb catch-all onto the top level for
// read convenience, so it has no `.data` property to merge into on write —
// fetch the raw catch-all separately when patching it.
async function getSubDataColumn(supabase, id) {
  const { data: row } = await supabase.from('member_subscriptions').select('data').eq('id', id).maybeSingle();
  return row?.data || {};
}

// ---------- ledger ----------

export async function logTransaction(supabase, { subscriptionId, customerId, type, note, amount = 0, actorId = null, meta = null }) {
  const doc = {
    id: randomUUID(), subscriptionId, customerId, type, note: note || null, amount, actorId,
    meta: meta || null, createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from('membership_transactions').insert({
    id: doc.id, subscription_id: subscriptionId, type, note: doc.note, amount, actor_id: actorId,
    created_at: doc.createdAt, data: { customerId, meta: doc.meta },
  });
  if (error) throw error;
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
  const supabase = getSupabase();
  const { data: planRow } = await supabase.from('memberships').select('*').eq('id', planId).maybeSingle();
  const plan = toMembership(planRow);
  if (!plan) throw new Error('plan_not_found');
  const now = startAt ? new Date(startAt) : new Date();
  const end = new Date(now); end.setDate(end.getDate() + (plan.validityDays || 30));
  const snapshot = normalizePlan(plan);
  // If the caller claims 'online' payment but hasn't attached a payment
  // reference (razorpay_payment_id / order id), the sub is held as
  // pending_payment. It will NOT be auto-consumed by the booking engine
  // until reception marks it paid or a real razorpay webhook activates it.
  const needsPayment = payment.method === 'online' && !payment.ref;
  const id = randomUUID();
  const { error } = await supabase.from('member_subscriptions').insert({
    id, customer_id: customerId, membership_id: plan.id, plan_name: snapshot.name, plan_snapshot: snapshot,
    status: needsPayment ? 'pending_payment' : 'active', starts_at: now.toISOString(), expires_at: end.toISOString(),
    sessions_remaining: snapshot.sessionsIncluded, wallet_balance: snapshot.walletCredit, freeze_history: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    data: { sessionsIncluded: snapshot.sessionsIncluded, sessionsUsed: 0, payment: { method: payment.method, ref: payment.ref || null, amount: snapshot.price } },
  });
  if (error) throw error;
  await logTransaction(supabase, {
    subscriptionId: id, customerId, type: needsPayment ? 'purchase_pending' : 'purchase',
    amount: snapshot.price, actorId,
    note: needsPayment
      ? `Reserved "${snapshot.name}" — awaiting payment via ${payment.method}`
      : `Purchased "${snapshot.name}" via ${payment.method}`,
    meta: { paymentRef: payment.ref || null },
  });
  return getSub(supabase, id);
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
  const supabase = getSupabase();
  const now = atIso ? new Date(atIso) : new Date();
  const { data: rows } = await supabase.from('member_subscriptions').select('*')
    .eq('customer_id', customerId).eq('status', 'active')
    .lte('starts_at', now.toISOString()).gte('expires_at', now.toISOString());
  const active = (rows || []).map(toSubscription);
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
  return eligible[0];
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
  const supabase = getSupabase();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  if (plan.dailyUsageLimit > 0) {
    const { count } = await supabase.from('membership_usage').select('id', { count: 'exact', head: true })
      .eq('subscription_id', subscription.id).gte('consumed_at', dayStart.toISOString());
    if ((count || 0) >= plan.dailyUsageLimit) return { ok: false, reason: 'daily_limit_reached' };
  }
  if (plan.weeklyUsageLimit > 0) {
    const { count } = await supabase.from('membership_usage').select('id', { count: 'exact', head: true })
      .eq('subscription_id', subscription.id).gte('consumed_at', weekStart.toISOString());
    if ((count || 0) >= plan.weeklyUsageLimit) return { ok: false, reason: 'weekly_limit_reached' };
  }
  if (plan.monthlyUsageLimit > 0) {
    const { count } = await supabase.from('membership_usage').select('id', { count: 'exact', head: true })
      .eq('subscription_id', subscription.id).gte('consumed_at', monthStart.toISOString());
    if ((count || 0) >= plan.monthlyUsageLimit) return { ok: false, reason: 'monthly_limit_reached' };
  }

  // Cooldown between consecutive uses.
  if (plan.cooldownMin > 0) {
    const cutoff = new Date(now.getTime() - plan.cooldownMin * 60000);
    const { data: recent } = await supabase.from('membership_usage').select('id')
      .eq('subscription_id', subscription.id).gt('consumed_at', cutoff.toISOString()).limit(1).maybeSingle();
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
  const supabase = getSupabase();
  const { error: usageErr } = await supabase.from('membership_usage').insert({
    id: randomUUID(), subscription_id: subscription.id, booking_id: bookingId, therapy_slug: therapySlug || null,
    consumed_at: atIso || new Date().toISOString(), data: { customerId: subscription.customerId, branchId: branchId || null },
  });
  if (usageErr) throw usageErr;

  const plan = subscription.planSnapshot || {};
  if (plan.type === 'sessions') {
    const { error } = await supabase.rpc('consume_subscription_session', { p_subscription_id: subscription.id });
    if (error) throw error;
  }

  await logTransaction(supabase, {
    subscriptionId: subscription.id, customerId: subscription.customerId, type: 'consume', actorId,
    note: `Session consumed for booking ${bookingId} (${therapySlug || 'unspecified'})`,
    meta: { bookingId, therapySlug, branchId },
  });
  return getSub(supabase, subscription.id);
}

// ---------- freeze / unfreeze / extend / adjust ----------

export async function freezeSubscription({ subscriptionId, actorId, reason }) {
  const supabase = getSupabase();
  const before = await getSub(supabase, subscriptionId);
  if (!before) throw new Error('not_found');
  if (!before.planSnapshot?.freezeAllowed) throw new Error('freeze_not_allowed');
  const now = new Date().toISOString();
  const curData = await getSubDataColumn(supabase, subscriptionId);
  const { error } = await supabase.from('member_subscriptions').update({
    status: 'frozen', updated_at: now,
    freeze_history: [...(before.freezeHistory || []), { at: now, by: actorId, reason: reason || null }],
    data: { ...curData, frozenAt: now },
  }).eq('id', subscriptionId);
  if (error) throw error;
  await logTransaction(supabase, { subscriptionId, customerId: before.customerId, type: 'freeze', actorId, note: reason || 'Frozen' });
  return getSub(supabase, subscriptionId);
}

export async function unfreezeSubscription({ subscriptionId, actorId }) {
  const supabase = getSupabase();
  const before = await getSub(supabase, subscriptionId);
  if (!before) throw new Error('not_found');
  if (before.status !== 'frozen') throw new Error('not_frozen');
  // Extend endAt by the frozen duration.
  const frozenSince = before.frozenAt ? new Date(before.frozenAt) : null;
  const now = new Date();
  const extraMs = frozenSince ? now.getTime() - frozenSince.getTime() : 0;
  const newEnd = new Date(new Date(before.endAt).getTime() + extraMs).toISOString();
  const curData = await getSubDataColumn(supabase, subscriptionId);
  const { error } = await supabase.from('member_subscriptions').update({
    status: 'active', expires_at: newEnd, updated_at: now.toISOString(),
    data: { ...curData, frozenAt: null },
  }).eq('id', subscriptionId);
  if (error) throw error;
  await logTransaction(supabase, {
    subscriptionId, customerId: before.customerId, type: 'unfreeze', actorId,
    note: `Unfrozen; validity extended by ${Math.round(extraMs / 86400000)} days`,
  });
  return getSub(supabase, subscriptionId);
}

export async function extendSubscription({ subscriptionId, days, actorId, note }) {
  const supabase = getSupabase();
  const before = await getSub(supabase, subscriptionId);
  if (!before) throw new Error('not_found');
  const newEnd = new Date(new Date(before.endAt).getTime() + Number(days) * 86400000).toISOString();
  const { error } = await supabase.from('member_subscriptions').update({ expires_at: newEnd, updated_at: new Date().toISOString() }).eq('id', subscriptionId);
  if (error) throw error;
  await logTransaction(supabase, {
    subscriptionId, customerId: before.customerId, type: 'extend', actorId,
    amount: Number(days), note: note || `Validity extended by ${days} days`,
  });
  return getSub(supabase, subscriptionId);
}

export async function adjustSubscription({ subscriptionId, sessionsDelta = 0, walletDelta = 0, actorId, note }) {
  const supabase = getSupabase();
  const before = await getSub(supabase, subscriptionId);
  if (!before) throw new Error('not_found');
  if (!sessionsDelta && !walletDelta) throw new Error('nothing_to_adjust');
  const { error } = await supabase.rpc('adjust_subscription_balances', {
    p_subscription_id: subscriptionId, p_sessions_delta: Number(sessionsDelta) || 0, p_wallet_delta: Number(walletDelta) || 0,
  });
  if (error) throw error;
  await logTransaction(supabase, {
    subscriptionId, customerId: before.customerId, type: 'adjust', actorId,
    amount: sessionsDelta || walletDelta, note: note || 'Manual adjustment',
    meta: { sessionsDelta, walletDelta },
  });
  return getSub(supabase, subscriptionId);
}

export async function cancelSubscription({ subscriptionId, actorId, reason }) {
  const supabase = getSupabase();
  const before = await getSub(supabase, subscriptionId);
  if (!before) throw new Error('not_found');
  // BUSINESS RULE (26-Aug-2026): once a subscription has been paid AND
  // activated, it cannot be cancelled. Only `pending_payment` and unpaid
  // states may be cancelled. Refunds/pauses go through separate flows.
  const isPaid = before.status === 'active' || !!before.paidAt;
  if (isPaid && before.status !== 'pending_payment') {
    const err = new Error('cannot_cancel_paid_subscription');
    err.code = 'cannot_cancel_paid_subscription';
    err.message = 'Memberships cannot be cancelled after successful payment.';
    throw err;
  }
  const curData = await getSubDataColumn(supabase, subscriptionId);
  const { error } = await supabase.from('member_subscriptions').update({
    status: 'cancelled', updated_at: new Date().toISOString(),
    data: { ...curData, cancelledAt: new Date().toISOString(), cancelReason: reason || null },
  }).eq('id', subscriptionId);
  if (error) throw error;
  await logTransaction(supabase, { subscriptionId, customerId: before.customerId, type: 'cancel', actorId, note: reason || 'Cancelled' });
  return getSub(supabase, subscriptionId);
}

/** Admin-only: mark a `pending_payment` subscription as fully paid & active. */
export async function markSubscriptionPaid({ subscriptionId, actorId, paymentRef, method = 'offline' }) {
  const supabase = getSupabase();
  const before = await getSub(supabase, subscriptionId);
  if (!before) throw new Error('not_found');
  if (before.status !== 'pending_payment') throw new Error('not_pending');
  const curData = await getSubDataColumn(supabase, subscriptionId);
  const { error } = await supabase.from('member_subscriptions').update({
    status: 'active', updated_at: new Date().toISOString(),
    data: {
      ...curData,
      payment: { ...(curData.payment || {}), method: method || curData.payment?.method || 'offline', ref: paymentRef || null },
      paidAt: new Date().toISOString(),
    },
  }).eq('id', subscriptionId);
  if (error) throw error;
  await logTransaction(supabase, {
    subscriptionId, customerId: before.customerId, type: 'purchase', actorId,
    amount: before.planSnapshot?.price || 0,
    note: `Marked paid via ${method || 'offline'}`,
    meta: { paymentRef: paymentRef || null },
  });
  return getSub(supabase, subscriptionId);
}

// ---------- daily maintenance (call from a cron / worker later) ----------

export async function expireSubscriptions() {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('member_subscriptions')
    .update({ status: 'expired' }).eq('status', 'active').lt('expires_at', now).select('id');
  if (error) throw error;
  return { expired: data?.length || 0 };
}
