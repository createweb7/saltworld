// -----------------------------------------------------------------------------
// UNIFIED PRICING ENGINE — Salt World
// -----------------------------------------------------------------------------
// Single source of truth for booking pricing across:
//   - Website checkout   (BookingClient sidebar)
//   - Admin new-booking
//   - Reception POS
//   - Booking API POST /api/bookings
//
// Discount stack (fixed order — user confirmed 05-Aug-2026):
//   1. Membership   → covers eligible sessions entirely (line-level)
//   2. Wallet       → points redeemed at redeemRate, capped by maxRedeemPct
//   3. Coupon       → % or flat off the remaining subtotal (single coupon only)
//   4. Gift Card    → deduct from the remaining subtotal (single card only)
//
// Rules:
//   - Prices come from admin `therapies` table (defaultPrice).
//   - No double-discount. Every step operates on the balance *after* prior steps.
//   - Wallet+coupon+giftcard never take the payable below ₹0.
//   - Membership applies FIRST because it zeros the line; wallet/coupon/giftcard
//     then only touch what's left.
//   - Returns a fully itemised breakdown so any UI can render it.
// -----------------------------------------------------------------------------

import { getSupabase } from '@/lib/supabase';
import { toTherapy, toSubscription, toGiftcard } from '@/lib/db-mappers';

/**
 * Resolve the price for one therapy line. Therapies with a `durationOptions`
 * matrix (e.g. Float Tank's 60/90-min × single/couple grid) price off the
 * requested durationMin + sessionMode; everything else uses `defaultPrice`.
 */
function resolveLinePrice(t, { durationMin, sessionMode } = {}) {
  const options = Array.isArray(t?.durationOptions) ? t.durationOptions : null;
  if (options && options.length) {
    const wantDur = Number(durationMin) || Number(t.durationMin) || options[0].durationMin;
    const opt = options.find((o) => Number(o.durationMin) === wantDur) || options[0];
    const price = sessionMode === 'couple' ? opt.priceCouple : opt.priceSingle;
    if (price != null) return { priceInr: Number(price) || 0, durationMin: Number(opt.durationMin) };
  }
  return { priceInr: Number(t?.defaultPrice) || 0, durationMin: Number(t?.durationMin) || 0 };
}

/**
 * Fetch base line prices for the given therapy line requests.
 * Uses `defaultPrice` from admin catalog, or the durationOptions matrix when
 * present (see resolveLinePrice). Missing therapies get 0.
 */
async function loadTherapyLines(therapyLines = []) {
  if (!therapyLines.length) return [];
  const slugs = therapyLines.map((t) => t.slug);
  const supabase = getSupabase();
  const { data: rows } = await supabase.from('therapies').select('*').in('slug', slugs);
  const bySlug = {};
  for (const r of rows || []) bySlug[r.slug] = toTherapy(r);
  return therapyLines.map(({ slug, durationMin, sessionMode }) => {
    const t = bySlug[slug];
    const resolved = resolveLinePrice(t, { durationMin, sessionMode });
    return {
      slug,
      name:          t?.name || slug,
      durationMin:   resolved.durationMin,
      priceInr:      resolved.priceInr,
      maxCapacity:   Number(t?.maxCapacity) || 1,
    };
  });
}

/**
 * Load loyalty config (redeemRate, maxRedeemPct) with sensible defaults.
 */
async function loadLoyaltyConfig() {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'loyalty').maybeSingle();
  const value = row?.value || {};
  return {
    active:       value.active !== false,
    redeemRate:   Number(value.redeemRate)   || 0.1,   // 1 point = ₹0.1
    maxRedeemPct: Number(value.maxRedeemPct) || 0.5,   // 50% of subtotal
  };
}

/**
 * Validate + return the customer's active subscription (if applicable).
 * Consumes 1 session per therapy. Returns list of therapy slugs covered.
 */
async function evaluateMembership({ subscriptionId, customerId, therapies, branchId, atIso }) {
  if (!subscriptionId || !customerId || !therapies.length) return null;
  const supabase = getSupabase();
  const { data: subRow } = await supabase.from('member_subscriptions').select('*')
    .eq('id', subscriptionId).eq('customer_id', customerId).maybeSingle();
  const sub = toSubscription(subRow);
  if (!sub) return { error: 'membership_not_found' };
  const { validateForBooking } = await import('@/lib/memberships');
  const covered = [];
  for (const t of therapies) {
    const check = await validateForBooking({ subscription: sub, therapySlug: t.slug, branchId, atIso });
    if (check.ok) covered.push(t.slug);
  }
  if (!covered.length) return { error: 'membership_no_match' };
  const plan = sub.planSnapshot || {};
  const needed = covered.length;
  if (plan.type === 'sessions' && (sub.sessionsRemaining || 0) < needed) {
    return { error: 'membership_insufficient_sessions', have: sub.sessionsRemaining || 0, need: needed };
  }
  return {
    subscriptionId: sub.id,
    planName: sub.planName || plan.name,
    type: plan.type,
    coveredSlugs: covered,
    sessionsConsumed: needed,
  };
}

/**
 * Compute wallet debit given available points and the current remaining subtotal.
 * Returns { pointsUsed, amountInr }.
 */
async function evaluateWallet({ customerId, requestedInr, remainingInr }) {
  if (!customerId || !requestedInr || requestedInr <= 0 || remainingInr <= 0) return null;
  const supabase = getSupabase();
  const cfg = await loadLoyaltyConfig();
  if (!cfg.active) return null;
  const { data: customer } = await supabase.from('customers').select('wallet_balance').eq('id', customerId).maybeSingle();
  const availablePoints = Number(customer?.wallet_balance) || 0;
  const availableInr = Math.floor(availablePoints * cfg.redeemRate);
  const capByPolicy = Math.floor(remainingInr * cfg.maxRedeemPct);
  const use = Math.min(requestedInr, availableInr, capByPolicy, remainingInr);
  if (use <= 0) return null;
  const pointsUsed = Math.ceil(use / cfg.redeemRate);
  return { pointsUsed, amountInr: use };
}

/**
 * Validate a coupon against the current remaining subtotal.
 */
async function evaluateCoupon({ code, customerId, phone, therapySlugs, branchId, remainingInr }) {
  if (!code || remainingInr <= 0) return null;
  const { getByCode, validateCoupon } = await import('@/lib/coupons');
  const coupon = await getByCode(code);
  if (!coupon) return { error: 'invalid_coupon' };

  const supabase = getSupabase();
  // First-time coupons need booking count by customerId OR phone.
  let customerBookingsCount = 0;
  if (customerId || phone) {
    let query = supabase.from('bookings').select('id', { count: 'exact', head: true }).neq('status', 'cancelled');
    const ors = [];
    if (customerId) ors.push(`customer_id.eq.${customerId}`);
    if (phone) {
      const digits = String(phone).replace(/\D/g, '');
      const phones = new Set([phone, digits]);
      if (digits.length > 10) phones.add(digits.slice(-10));
      ors.push(`contact_phone.in.(${[...phones].join(',')})`);
    }
    if (ors.length) {
      const { count } = await query.or(ors.join(','));
      customerBookingsCount = count || 0;
    }
  }
  const r = await validateCoupon(coupon, {
    subtotalInr: remainingInr,
    therapies:   therapySlugs,
    branchId, customerId,
    customerBookingsCount,
  });
  if (!r.ok) return { error: r.error || 'coupon_invalid' };
  return {
    couponId: coupon.id,
    code: coupon.code,
    kind: coupon.discountType,
    valueSnapshot: coupon.discountValue,
    amountInr: Math.min(remainingInr, r.discountInr),
  };
}

/**
 * Validate a gift card by code + PIN; return the deductible amount.
 */
async function evaluateGiftCard({ code, pin, requestedInr, remainingInr }) {
  if (!code || remainingInr <= 0) return null;
  const supabase = getSupabase();
  const { data: row } = await supabase.from('giftcards').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle();
  const gc = toGiftcard(row);
  if (!gc) return { error: 'giftcard_not_found' };
  if (gc.status !== 'active') return { error: `giftcard_${gc.status}` };
  if (gc.pin && pin && String(gc.pin) !== String(pin).trim()) return { error: 'giftcard_pin_invalid' };
  const balance = Number(gc.balance) || 0;
  const use = Math.min(balance, requestedInr || balance, remainingInr);
  if (use <= 0) return { error: 'giftcard_empty' };
  return {
    giftcardId: gc.id,
    code: gc.code,
    amountInr: use,
    balanceBefore: balance,
    balanceAfter: balance - use,
  };
}

/**
 * MAIN — compute a full quote from the inputs. No mutations to DB happen here;
 * this is a pure calculator. Callers persist the breakdown & call finalisers.
 *
 * Inputs:
 *   therapies:  [{ slug, durationMin?, sessionMode? }]   (base line items;
 *               durationMin/sessionMode only matter for therapies with a
 *               durationOptions price matrix, e.g. Float Tank)
 *   customerId, phone, branchId, atIso
 *   membershipSubscriptionId?   // opt-in to burn a subscription
 *   walletUseInr?               // requested ₹ to redeem from wallet points
 *   couponCode?
 *   giftCardCode?, giftCardPin?
 *
 * Output:
 *   {
 *     lines:            [{ slug, name, priceInr, coveredByMembership: bool }],
 *     baseSubtotalInr:  <sum of prices>,
 *     discounts: {
 *       membership: { subscriptionId, planName, coveredSlugs[], sessionsConsumed, amountInr } | null,
 *       wallet:     { pointsUsed, amountInr }                                                | null,
 *       coupon:     { couponId, code, amountInr }                                            | null,
 *       giftCard:   { giftcardId, code, amountInr, balanceAfter }                            | null,
 *     },
 *     payableInr:       <base - all discounts, floor 0>,
 *     currency:         'INR',
 *     errors:           [{ step, error }]   // non-fatal issues, so caller can show hints
 *   }
 */
export async function computeQuote({
  therapies = [],
  customerId = null, phone = null, branchId = null, atIso = null,
  membershipSubscriptionId = null,
  walletUseInr = 0,
  couponCode = null,
  giftCardCode = null, giftCardPin = null,
  guests = 1,
} = {}) {
  const errors = [];
  const lines = await loadTherapyLines(therapies);
  // Shared-capacity resources (e.g. the Salt Cave, capacity 7) are booked per
  // person, not per room — multiply those lines by the requested headcount.
  // Private/exclusive-lock resources (capacity 1, e.g. Float Tank) are
  // unaffected since `guests` is always 1 for a journey that doesn't include
  // a shared-capacity therapy.
  const guestCount = Math.max(1, Number(guests) || 1);
  if (guestCount > 1) {
    for (const l of lines) {
      if (l.maxCapacity > 1) l.priceInr = l.priceInr * guestCount;
    }
  }
  const baseSubtotalInr = lines.reduce((s, l) => s + l.priceInr, 0);

  // ---- 1. Membership -------------------------------------------------------
  let membership = null;
  if (membershipSubscriptionId) {
    const r = await evaluateMembership({ subscriptionId: membershipSubscriptionId, customerId, therapies: lines, branchId, atIso });
    if (r?.error) errors.push({ step: 'membership', error: r.error, ...r });
    else if (r) {
      const coveredSet = new Set(r.coveredSlugs);
      const coveredAmount = lines.filter((l) => coveredSet.has(l.slug)).reduce((s, l) => s + l.priceInr, 0);
      membership = { ...r, amountInr: coveredAmount };
      // Mark lines as covered.
      for (const l of lines) l.coveredByMembership = coveredSet.has(l.slug);
    }
  }
  let remaining = baseSubtotalInr - (membership?.amountInr || 0);

  // ---- 2. Wallet -----------------------------------------------------------
  let wallet = null;
  if (walletUseInr && walletUseInr > 0 && remaining > 0) {
    const r = await evaluateWallet({ customerId, requestedInr: Number(walletUseInr), remainingInr: remaining });
    if (r) {
      wallet = r;
      remaining -= r.amountInr;
    } else {
      errors.push({ step: 'wallet', error: 'wallet_unavailable' });
    }
  }

  // ---- 3. Coupon -----------------------------------------------------------
  let coupon = null;
  if (couponCode && remaining > 0) {
    const r = await evaluateCoupon({
      code: couponCode, customerId, phone,
      therapySlugs: lines.map((l) => l.slug),
      branchId, remainingInr: remaining,
    });
    if (r?.error) errors.push({ step: 'coupon', error: r.error });
    else if (r) {
      coupon = r;
      remaining -= r.amountInr;
    }
  }

  // ---- 4. Gift Card --------------------------------------------------------
  let giftCard = null;
  if (giftCardCode && remaining > 0) {
    const r = await evaluateGiftCard({ code: giftCardCode, pin: giftCardPin, requestedInr: remaining, remainingInr: remaining });
    if (r?.error) errors.push({ step: 'giftCard', error: r.error });
    else if (r) {
      giftCard = r;
      remaining -= r.amountInr;
    }
  }

  const payableInr = Math.max(0, Math.round(remaining));

  return {
    lines,
    baseSubtotalInr,
    discounts: { membership, wallet, coupon, giftCard },
    payableInr,
    currency: 'INR',
    errors,
  };
}

/**
 * Persist wallet debit + giftcard debit after a successful booking insert.
 * Call ONLY after the booking has been written and the slot committed.
 *
 * Returns nothing — errors are logged and swallowed so a partial finalise
 * (e.g. giftcard OK but wallet ledger insert failed) never blocks the flow.
 */
export async function commitQuoteSideEffects({ quote, bookingId, bookingRef, customerId, actorId = null }) {
  const supabase = getSupabase();

  // Wallet debit
  if (quote?.discounts?.wallet && customerId) {
    try {
      const { postTransaction, LOYALTY_TYPES } = await import('@/lib/loyalty');
      await postTransaction({
        customerId,
        type: LOYALTY_TYPES.BOOKING_REDEEM,
        points: -Math.abs(quote.discounts.wallet.pointsUsed),
        amountInr: quote.discounts.wallet.amountInr,
        note: `Wallet redeemed on ${bookingRef}`,
        ref: bookingRef,
        actorId,
      });
    } catch (e) { console.error('wallet debit failed', e); }
  }

  // Gift card debit
  if (quote?.discounts?.giftCard) {
    try {
      const gc = quote.discounts.giftCard;
      await supabase.from('giftcards').update({
        balance: gc.balanceAfter,
        status: gc.balanceAfter <= 0 ? 'redeemed' : 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', gc.giftcardId);
      await supabase.from('giftcard_redemptions').insert({
        giftcard_id: gc.giftcardId, booking_id: bookingId, booking_ref: bookingRef,
        amount: gc.amountInr, created_at: new Date().toISOString(),
      });
    } catch (e) { console.error('giftcard debit failed', e); }
  }

  // Coupon redemption ledger
  if (quote?.discounts?.coupon) {
    try {
      const { recordRedemption } = await import('@/lib/coupons');
      await recordRedemption({
        couponId: quote.discounts.coupon.couponId,
        code:     quote.discounts.coupon.code,
        customerId,
        bookingId,
        subtotalInr: quote.baseSubtotalInr,
        discountInr: quote.discounts.coupon.amountInr,
      });
    } catch (e) { console.error('coupon record failed', e); }
  }
}
