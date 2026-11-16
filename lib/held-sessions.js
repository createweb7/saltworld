// Held sessions — part of a package the guest didn't take on the day (e.g.
// booked 5 therapies, took 3, wants the other 2 another day). Reception holds
// the unused sessions on the booking (their rooms are freed), then either
// rebooks them later at no charge (any date, together or one at a time) or,
// in special cases, refunds them to the guest's wallet.
//
// Stored on the original booking as data.heldSessions:
//   { id, slug, label, durationMin, valueInr, heldAt, heldBy, expiresAt,
//     status: 'held' | 'rebooked' | 'refunded' | 'cancelled',
//     rebookedBookingId?, rebookedRef?, rebookedAt?, refundInr?, refundedAt? }
//
// Valid for 1 year from the date of purchase (agreed with the business,
// Nov 2026). Shared by the admin API and the admin booking page.

export const HELD_VALIDITY_YEARS = 1;

/** Purchase date + 1 year, as an ISO string. */
export function heldExpiry(purchasedAtIso) {
  const d = new Date(purchasedAtIso || Date.now());
  d.setFullYear(d.getFullYear() + HELD_VALIDITY_YEARS);
  return d.toISOString();
}

/** 'held' sessions past their expiry show as 'expired'. */
export function heldStatus(s, now = new Date()) {
  if (s?.status === 'held' && s.expiresAt && new Date(s.expiresAt) < now) return 'expired';
  return s?.status || 'held';
}

/**
 * What the guest paid for the package, in any form (money, gift card,
 * wallet) — i.e. the price after bundle / coupon / membership discounts.
 */
export function packageValueInr(booking) {
  const pb = booking?.pricingBreakdown;
  const d = pb?.discounts || {};
  if (pb && pb.payableInr != null) {
    return Math.max(0, Math.round(Number(pb.payableInr) + (Number(d.giftCard?.amountInr) || 0) + (Number(d.wallet?.amountInr) || 0)));
  }
  return Math.max(0, Math.round(Number(booking?.total) || 0));
}

/**
 * Each therapy's share of the package value, in proportion to its own list
 * price (so a held Float is worth more than a held Red Light). Returns
 * { [slug]: valueInr }; shares add up exactly to the package value.
 */
export function sessionValues(booking, slugs) {
  const value = packageValueInr(booking);
  const lines = Array.isArray(booking?.pricingBreakdown?.lines) ? booking.pricingBreakdown.lines : [];
  const all = lines.length ? lines.map((l) => ({ slug: l.slug, price: Number(l.priceInr) || 0 }))
    : (booking?.therapies || []).map((t) => ({ slug: t.slug, price: 1 }));
  const sum = all.reduce((s, l) => s + l.price, 0);
  const out = {};
  let given = 0;
  all.forEach((l, i) => {
    const share = i === all.length - 1 ? value - given : (sum > 0 ? Math.round((value * l.price) / sum) : 0);
    given += share;
    out[l.slug] = Math.max(0, share);
  });
  return Object.fromEntries((slugs || Object.keys(out)).map((s) => [s, out[s] ?? 0]));
}

/** Already refunded to the wallet for held sessions on this booking. */
export function heldRefundedInr(booking) {
  return (booking?.heldSessions || []).reduce((s, h) => s + (h.status === 'refunded' ? Number(h.refundInr) || 0 : 0), 0);
}

/** Most that can still be refunded for held sessions on this booking. */
export function refundableInr(booking) {
  return Math.max(0, packageValueInr(booking) - heldRefundedInr(booking));
}
