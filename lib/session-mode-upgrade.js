// Solo -> Couple conversion for an already-confirmed booking.
//
// A booking's session mode (single/couple) only affects price + (for Float
// Therapy specifically) which tanks are eligible — see the Float-tank filter
// inside checkJourneyAvailability in lib/scheduling.js. Converting after the
// fact means: (1) price the difference using the same per-therapy
// solo/couple matrix the booking flow uses, (2) re-validate the booking's
// EXISTING schedule (same date/time) under the new mode so a Float leg stuck
// in a solo-only tank doesn't silently become invalid, (3) collect the
// difference online via Razorpay before applying it.
//
// Scope: upgrade only (single -> couple). Downgrading (couple -> single)
// would mean refunding part of what was already paid, and there's no refund
// flow in this codebase yet — out of scope here. Membership-paid bookings
// are also excluded: membership entitlements are consumed per-session, not
// priced per rupee, so "pay the price difference" doesn't apply cleanly.

import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { toBookingFull } from '@/lib/db-mappers';
import { loadTherapyLines } from '@/lib/pricing';
import { revalidateSessionMode } from '@/lib/scheduling';
import { createOrder as rpCreateOrder, verifySignature as rpVerifySignature, razorpayIsConfigured, getPublicKeyId } from '@/lib/razorpay';

const INELIGIBLE_STATUSES = ['cancelled', 'completed', 'no_show', 'payment_pending'];

async function loadDoc(bookingId) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!row) return null;
  const doc = await toBookingFull(supabase, row);
  return doc;
}

async function priceDiffInr(doc) {
  const lines = (doc.therapies || []).map((t) => ({ slug: t.slug, durationMin: t.durationMin }));
  const [singleLines, coupleLines] = await Promise.all([
    loadTherapyLines(lines.map((l) => ({ ...l, sessionMode: 'single' }))),
    loadTherapyLines(lines.map((l) => ({ ...l, sessionMode: 'couple' }))),
  ]);
  const singleTotal = singleLines.reduce((s, l) => s + (Number(l.priceInr) || 0), 0);
  const coupleTotal = coupleLines.reduce((s, l) => s + (Number(l.priceInr) || 0), 0);
  return Math.max(0, coupleTotal - singleTotal);
}

export async function quoteSessionModeUpgrade(bookingId) {
  const doc = await loadDoc(bookingId);
  if (!doc) return { ok: false, error: 'not_found' };
  if (INELIGIBLE_STATUSES.includes(doc.status)) return { ok: false, error: `booking_${doc.status}` };
  if (doc.sessionMode === 'couple') return { ok: false, error: 'already_couple' };
  if (doc.payment === 'membership') return { ok: false, error: 'membership_not_supported' };
  const diffInr = await priceDiffInr(doc);
  if (diffInr <= 0) return { ok: false, error: 'no_couple_pricing' };
  return { ok: true, diffInr, newTotalInr: (Number(doc.total) || 0) + diffInr, booking: doc };
}

export async function createSessionModeUpgradeOrder(bookingId) {
  const quote = await quoteSessionModeUpgrade(bookingId);
  if (!quote.ok) return quote;
  const { doc, diffInr } = quote;
  // Fail fast, before charging anything, if the existing schedule can't
  // actually run as Couple (e.g. no couple-capable Float tank free at that
  // time) — re-checked again at verify time to close the narrow race window.
  const feasibility = await revalidateSessionMode({
    bookingId, branchId: doc.branchId, schedule: doc.schedule, sessionMode: 'couple',
    guests: doc.guests, children: doc.children,
  });
  if (!feasibility.ok) return { ok: false, error: feasibility.reason || 'not_available_as_couple' };
  if (!(await razorpayIsConfigured())) return { ok: false, error: 'razorpay_not_configured' };
  let rpOrder;
  try {
    rpOrder = await rpCreateOrder({
      amountPaise: Math.round(diffInr * 100),
      currency: 'INR',
      receipt: `${doc.ref}-couple`.slice(0, 24),
      notes: { bookingId, kind: 'session_mode_upgrade', targetSessionMode: 'couple' },
    });
  } catch (e) {
    return { ok: false, error: 'razorpay_error', details: String(e?.message || e) };
  }
  const supabase = getSupabase();
  await supabase.from('booking_payments').insert({
    id: randomUUID(), booking_id: bookingId, provider: 'razorpay', provider_order_id: rpOrder.id,
    amount: rpOrder.amount, status: 'created', created_at: new Date().toISOString(),
    raw: { kind: 'session_mode_upgrade', targetSessionMode: 'couple', diffInr, currency: rpOrder.currency },
  });
  const keyId = await getPublicKeyId();
  return { ok: true, order: { id: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency }, keyId, diffInr };
}

export async function verifySessionModeUpgrade({ bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, actorId = null }) {
  const supabase = getSupabase();
  const { data: paymentRecord } = await supabase.from('booking_payments').select('*')
    .eq('booking_id', bookingId).eq('provider_order_id', razorpay_order_id).maybeSingle();
  if (!paymentRecord || paymentRecord.raw?.kind !== 'session_mode_upgrade') {
    return { ok: false, error: 'payment_record_not_found' };
  }
  if (paymentRecord.status === 'verified') return { ok: true, alreadyApplied: true };
  const nowIso = new Date().toISOString();
  const valid = await rpVerifySignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
  if (!valid) {
    await supabase.from('booking_payments').update({
      status: 'signature_failed', provider_payment_id: razorpay_payment_id, updated_at: nowIso,
    }).eq('id', paymentRecord.id);
    return { ok: false, error: 'signature_mismatch' };
  }

  const doc = await loadDoc(bookingId);
  if (!doc) return { ok: false, error: 'not_found' };

  // Re-check right before applying — closes the (rare) race where the only
  // couple-capable tank at this time got taken between order-creation and
  // payment. The payment itself is already captured by Razorpay at this
  // point; there's no refund flow here, so this is flagged for manual
  // reception follow-up rather than silently lost.
  const feasibility = await revalidateSessionMode({
    bookingId, branchId: doc.branchId, schedule: doc.schedule, sessionMode: 'couple',
    guests: doc.guests, children: doc.children,
  });
  if (!feasibility.ok) {
    await supabase.from('booking_payments').update({
      status: 'paid_unapplied', provider_payment_id: razorpay_payment_id, updated_at: nowIso,
      raw: { ...paymentRecord.raw, failReason: feasibility.reason || 'not_available_as_couple' },
    }).eq('id', paymentRecord.id);
    return { ok: false, error: 'conversion_failed_after_payment', reason: feasibility.reason };
  }

  const diffInr = Number(paymentRecord.raw?.diffInr) || 0;
  const { data: row } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  const newTotal = (Number(row?.total) || 0) + diffInr;

  await supabase.from('bookings').update({
    session_mode: 'couple',
    total: newTotal,
    primary_resource_id: feasibility.assignments[0]?.resourceId ?? row.primary_resource_id,
    primary_resource_name: feasibility.assignments[0]?.resourceName ?? row.primary_resource_name,
    updated_at: nowIso,
    data: {
      ...row.data,
      sessionModeUpgrade: { at: nowIso, diffInr, paymentId: razorpay_payment_id, by: actorId ? 'staff' : 'customer', actorId },
    },
  }).eq('id', bookingId);

  // Zip by position rather than matching on from/therapySlug values — avoids
  // any risk of string-format mismatch on the timestamp round-trip.
  const { data: itemRows } = await supabase.from('booking_schedule_items')
    .select('id').eq('booking_id', bookingId).order('position', { ascending: true });
  for (let i = 0; i < (itemRows || []).length && i < feasibility.assignments.length; i++) {
    await supabase.from('booking_schedule_items')
      .update({ resource_id: feasibility.assignments[i].resourceId })
      .eq('id', itemRows[i].id);
  }

  await supabase.from('booking_payments').update({
    status: 'verified', provider_payment_id: razorpay_payment_id, updated_at: nowIso,
  }).eq('id', paymentRecord.id);

  return { ok: true, diffInr, newTotal };
}
