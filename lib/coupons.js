// Salt World — Coupons Engine (Influencer + Marketing).
//
// A coupon is a code the customer types at checkout. It validates against a
// dozen constraints (window, usage limits, applicable therapies/branches,
// minimum purchase) and returns the discount — or a structured error.
//
// The engine is intentionally simple to reason about: no compounding, no
// stacking with other coupons, no automatic discovery. Marketing owns the
// campaign strategy from the Admin UI.

import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';

export const DISCOUNT_TYPES = ['percent', 'flat'];

function toCoupon(row) {
  if (!row) return null;
  const { data, ...c } = row;
  return {
    ...data,
    id: c.id, code: c.code, discountType: c.discount_type, discountValue: Number(c.discount_value),
    applicableTherapies: c.applicable_therapies || [], applicableBranches: c.applicable_branches || [],
    firstTimeOnly: c.first_time_only, active: c.active,
    startsAt: c.starts_at, endsAt: c.expires_at, usageLimit: c.usage_limit || 0,
    createdAt: c.created_at, updatedAt: c.updated_at,
  };
}

// ------ Coupon lifecycle ------

function normalize(input) {
  const raw = String(input.code || '').trim().toUpperCase().replace(/\s+/g, '');
  return {
    id: input.id || randomUUID(),
    code: raw,
    influencerName: input.influencerName || '',
    campaign: input.campaign || '',
    discountType:  DISCOUNT_TYPES.includes(input.discountType) ? input.discountType : 'percent',
    discountValue: Number(input.discountValue) || 0,
    maxDiscountInr: Number(input.maxDiscountInr) || 0,   // cap on percent discounts
    minPurchaseInr: Number(input.minPurchaseInr) || 0,
    startsAt: input.startsAt || new Date().toISOString(),
    endsAt:   input.endsAt   || null,                     // ISO or null = no expiry
    usageLimit:        Number(input.usageLimit)        || 0, // 0 = unlimited
    perCustomerLimit:  Number(input.perCustomerLimit)  || 1,
    applicableTherapies: Array.isArray(input.applicableTherapies) ? input.applicableTherapies : [],
    applicableBranches:  Array.isArray(input.applicableBranches)  ? input.applicableBranches  : [],
    firstTimeOnly: Boolean(input.firstTimeOnly),
    active: input.active !== false,
    createdBy: input.createdBy || null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Denormalized counters — kept in-sync when redemption occurs. Reporting
    // reads from these directly; source of truth is `coupon_redemptions`.
    totalRedemptions: Number(input.totalRedemptions) || 0,
    totalRevenueInr:  Number(input.totalRevenueInr)  || 0,
    totalDiscountInr: Number(input.totalDiscountInr) || 0,
  };
}

function toRow(doc) {
  return {
    id: doc.id, code: doc.code, discount_type: doc.discountType, discount_value: doc.discountValue,
    applicable_therapies: doc.applicableTherapies, applicable_branches: doc.applicableBranches,
    first_time_only: doc.firstTimeOnly, active: doc.active, starts_at: doc.startsAt, expires_at: doc.endsAt,
    usage_limit: doc.usageLimit, created_at: doc.createdAt, updated_at: doc.updatedAt,
    data: {
      influencerName: doc.influencerName, campaign: doc.campaign, maxDiscountInr: doc.maxDiscountInr,
      minPurchaseInr: doc.minPurchaseInr, perCustomerLimit: doc.perCustomerLimit, createdBy: doc.createdBy,
      totalRedemptions: doc.totalRedemptions, totalRevenueInr: doc.totalRevenueInr, totalDiscountInr: doc.totalDiscountInr,
    },
  };
}

export async function createCoupon(input) {
  if (!input.code) throw new Error('code_required');
  const doc = normalize(input);
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('coupons').select('id').eq('code', doc.code).maybeSingle();
  if (existing) throw new Error('code_already_exists');
  const { error } = await supabase.from('coupons').insert(toRow(doc));
  if (error) throw error;
  return doc;
}

export async function updateCoupon(id, patch) {
  const supabase = getSupabase();
  const { data: curRow } = await supabase.from('coupons').select('*').eq('id', id).maybeSingle();
  const clean = toCoupon(curRow);
  if (!clean) throw new Error('not_found');
  // Do not allow raw code change if it collides.
  if (patch.code) {
    const rawCode = String(patch.code).trim().toUpperCase().replace(/\s+/g, '');
    if (rawCode !== clean.code) {
      const { data: collision } = await supabase.from('coupons').select('id').eq('code', rawCode).neq('id', id).maybeSingle();
      if (collision) throw new Error('code_already_exists');
    }
  }
  const next = normalize({ ...clean, ...patch, id, createdAt: clean.createdAt });
  const { error } = await supabase.from('coupons').update(toRow(next)).eq('id', id);
  if (error) throw error;
  return next;
}

export async function deleteCoupon(id) {
  const supabase = getSupabase();
  await supabase.from('coupons').delete().eq('id', id);
  return { ok: true };
}

export async function listCoupons({ active = null } = {}) {
  const supabase = getSupabase();
  let query = supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (active !== null) query = query.eq('active', active);
  const { data: rows, error } = await query;
  if (error) throw error;
  return rows.map(toCoupon);
}

export async function getByCode(code) {
  const raw = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;
  const supabase = getSupabase();
  const { data: row } = await supabase.from('coupons').select('*').eq('code', raw).maybeSingle();
  return toCoupon(row);
}

export async function getById(id) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('coupons').select('*').eq('id', id).maybeSingle();
  return toCoupon(row);
}

// ------ Validation & apply ------

/**
 * validateCoupon
 *   Given a coupon (already loaded) and a checkout context, decides if it can
 *   be applied and how much to discount.
 *
 * ctx = {
 *   subtotalInr: number,
 *   therapies:   string[]      // slugs in the cart
 *   branchId:    string|null,
 *   customerId:  string|null,
 *   customerBookingsCount: number,   // used for firstTimeOnly check
 * }
 */
export async function validateCoupon(coupon, ctx = {}) {
  if (!coupon)              return { ok: false, error: 'not_found',      message: 'Coupon code is invalid.' };
  if (!coupon.active)       return { ok: false, error: 'inactive',       message: 'This coupon is no longer active.' };
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now)
                            return { ok: false, error: 'not_yet_active', message: 'This coupon becomes valid on ' + new Date(coupon.startsAt).toLocaleDateString() + '.' };
  if (coupon.endsAt   && new Date(coupon.endsAt).getTime()   < now)
                            return { ok: false, error: 'expired',        message: 'This coupon expired.' };
  if (coupon.usageLimit > 0 && coupon.totalRedemptions >= coupon.usageLimit)
                            return { ok: false, error: 'limit_reached',  message: 'This coupon has reached its total usage limit.' };
  if (coupon.minPurchaseInr > 0 && Number(ctx.subtotalInr || 0) < coupon.minPurchaseInr)
                            return { ok: false, error: 'min_purchase',   message: `Minimum cart of ₹${coupon.minPurchaseInr.toLocaleString('en-IN')} required (yours is ₹${Number(ctx.subtotalInr||0).toLocaleString('en-IN')}).` };
  if (Array.isArray(coupon.applicableTherapies) && coupon.applicableTherapies.length > 0) {
    const cart = new Set(ctx.therapies || []);
    const overlap = coupon.applicableTherapies.some((t) => cart.has(t));
    if (!overlap) return { ok: false, error: 'therapy_ineligible', message: 'This coupon does not apply to the selected therapies.' };
  }
  if (Array.isArray(coupon.applicableBranches) && coupon.applicableBranches.length > 0) {
    if (!ctx.branchId || !coupon.applicableBranches.includes(ctx.branchId)) {
      return { ok: false, error: 'branch_ineligible', message: 'This coupon is not valid at this branch.' };
    }
  }
  if (coupon.firstTimeOnly && Number(ctx.customerBookingsCount || 0) > 0) {
    return { ok: false, error: 'first_time_only', message: 'This coupon is for first-time bookings only.' };
  }
  if (coupon.perCustomerLimit > 0 && ctx.customerId) {
    const supabase = getSupabase();
    const { count } = await supabase.from('coupon_redemptions').select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id).eq('customer_id', ctx.customerId);
    if ((count || 0) >= coupon.perCustomerLimit) {
      return { ok: false, error: 'per_customer_limit', message: 'You have already used this coupon the maximum number of times.' };
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === 'percent') {
    discount = Math.round((Number(ctx.subtotalInr) || 0) * (Number(coupon.discountValue) / 100));
    if (coupon.maxDiscountInr > 0) discount = Math.min(discount, coupon.maxDiscountInr);
  } else {
    discount = Number(coupon.discountValue) || 0;
  }
  discount = Math.max(0, Math.min(discount, Number(ctx.subtotalInr) || 0));

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      influencerName: coupon.influencerName,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
    discountInr: discount,
    finalInr: Math.max(0, (Number(ctx.subtotalInr) || 0) - discount),
  };
}

/**
 * recordRedemption — immutable ledger entry per redemption, plus updates the
 * denormalized counters on the coupon (atomically, via a Postgres function).
 */
export async function recordRedemption({ couponId, code, customerId = null, bookingId = null, subtotalInr, discountInr }) {
  const supabase = getSupabase();
  const doc = {
    id: randomUUID(), couponId, code, customerId, bookingId,
    subtotalInr: Number(subtotalInr) || 0, discountInr: Number(discountInr) || 0,
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from('coupon_redemptions').insert({
    id: doc.id, coupon_id: couponId, booking_id: bookingId, customer_id: customerId,
    subtotal_inr: doc.subtotalInr, discount_inr: doc.discountInr, created_at: doc.createdAt,
    data: { code },
  });
  if (error) throw error;
  await supabase.rpc('increment_coupon_counters', {
    p_coupon_id: couponId, p_redemptions: 1, p_revenue: doc.subtotalInr, p_discount: doc.discountInr,
  });
  return doc;
}

// ------ Reporting ------

export async function reportCoupons({ from = null, to = null } = {}) {
  const supabase = getSupabase();
  let query = supabase.from('coupon_redemptions').select('coupon_id, subtotal_inr, discount_inr, data, created_at');
  if (from) query = query.gte('created_at', from);
  if (to)   query = query.lt('created_at', to);
  const { data: rows, error } = await query;
  if (error) throw error;

  const byCoupon = new Map();
  for (const r of rows || []) {
    const id = r.coupon_id;
    if (!id) continue;
    const cur = byCoupon.get(id) || { couponId: id, code: r.data?.code || '', redemptions: 0, revenue: 0, discount: 0 };
    cur.redemptions += 1;
    cur.revenue += Number(r.subtotal_inr || 0);
    cur.discount += Number(r.discount_inr || 0);
    byCoupon.set(id, cur);
  }
  const perCouponRaw = [...byCoupon.values()].sort((a, b) => b.revenue - a.revenue);

  const { data: coupons } = await supabase.from('coupons').select('id, data').in('id', perCouponRaw.map((b) => b.couponId));
  const nameByCoupon = {};
  for (const c of coupons || []) nameByCoupon[c.id] = { influencerName: c.data?.influencerName, campaign: c.data?.campaign };

  return {
    totalRedemptions: rows?.length || 0,
    totalRevenueInr:  perCouponRaw.reduce((s, r) => s + r.revenue,  0),
    totalDiscountInr: perCouponRaw.reduce((s, r) => s + r.discount, 0),
    perCoupon: perCouponRaw.map((b) => ({
      couponId: b.couponId, code: b.code,
      influencerName: nameByCoupon[b.couponId]?.influencerName || '',
      campaign:       nameByCoupon[b.couponId]?.campaign       || '',
      redemptions: b.redemptions, revenue: b.revenue, discount: b.discount,
    })),
  };
}

export async function listRedemptions({ couponId = null, customerId = null, limit = 100 } = {}) {
  const supabase = getSupabase();
  let query = supabase.from('coupon_redemptions').select('*').order('created_at', { ascending: false }).limit(limit);
  if (couponId)   query = query.eq('coupon_id', couponId);
  if (customerId) query = query.eq('customer_id', customerId);
  const { data: rows, error } = await query;
  if (error) throw error;
  return rows.map((r) => ({
    ...r.data, id: r.id, couponId: r.coupon_id, customerId: r.customer_id, bookingId: r.booking_id,
    subtotalInr: r.subtotal_inr, discountInr: r.discount_inr, createdAt: r.created_at,
  }));
}
