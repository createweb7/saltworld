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
import { getDb } from '@/lib/mongo';

const COL = 'coupons';
const REDEMPTIONS_COL = 'coupon_redemptions';

export const DISCOUNT_TYPES = ['percent', 'flat'];

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

export async function createCoupon(input) {
  if (!input.code) throw new Error('code_required');
  const doc = normalize(input);
  const db = await getDb();
  await db.collection(COL).createIndex({ code: 1 }, { unique: true });
  const existing = await db.collection(COL).findOne({ code: doc.code });
  if (existing) throw new Error('code_already_exists');
  await db.collection(COL).insertOne({ ...doc });
  return doc;
}

export async function updateCoupon(id, patch) {
  const db = await getDb();
  const cur = await db.collection(COL).findOne({ id });
  if (!cur) throw new Error('not_found');
  const { _id, ...clean } = cur;
  // Do not allow raw code change if it collides.
  if (patch.code) {
    const rawCode = String(patch.code).trim().toUpperCase().replace(/\s+/g, '');
    if (rawCode !== clean.code) {
      const collision = await db.collection(COL).findOne({ code: rawCode, id: { $ne: id } });
      if (collision) throw new Error('code_already_exists');
    }
  }
  const next = normalize({ ...clean, ...patch, id, createdAt: clean.createdAt });
  await db.collection(COL).updateOne({ id }, { $set: next });
  return next;
}

export async function deleteCoupon(id) {
  const db = await getDb();
  await db.collection(COL).deleteOne({ id });
  return { ok: true };
}

export async function listCoupons({ active = null } = {}) {
  const db = await getDb();
  const q = {};
  if (active !== null) q.active = active;
  const docs = await db.collection(COL).find(q).sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function getByCode(code) {
  const raw = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;
  const db = await getDb();
  const doc = await db.collection(COL).findOne({ code: raw });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function getById(id) {
  const db = await getDb();
  const doc = await db.collection(COL).findOne({ id });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
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
                            return { ok: false, error: 'min_purchase',   message: `Minimum purchase ₹${coupon.minPurchaseInr} required.` };
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
    const db = await getDb();
    const used = await db.collection(REDEMPTIONS_COL).countDocuments({ couponId: coupon.id, customerId: ctx.customerId });
    if (used >= coupon.perCustomerLimit) {
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
 * denormalized counters on the coupon.
 */
export async function recordRedemption({ couponId, code, customerId = null, bookingId = null, subtotalInr, discountInr }) {
  const db = await getDb();
  const doc = {
    id: randomUUID(),
    couponId, code,
    customerId, bookingId,
    subtotalInr: Number(subtotalInr) || 0,
    discountInr: Number(discountInr) || 0,
    createdAt: new Date().toISOString(),
  };
  await db.collection(REDEMPTIONS_COL).insertOne(doc);
  await db.collection(COL).updateOne({ id: couponId }, {
    $inc: {
      totalRedemptions: 1,
      totalRevenueInr:  Number(subtotalInr) || 0,
      totalDiscountInr: Number(discountInr) || 0,
    },
  });
  return doc;
}

// ------ Reporting ------

export async function reportCoupons({ from = null, to = null } = {}) {
  const db = await getDb();
  const match = {};
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to)   match.createdAt.$lt  = to;
  }
  const [byCoupon, totalReds] = await Promise.all([
    db.collection(REDEMPTIONS_COL).aggregate([
      { $match: match },
      { $group: {
        _id: '$couponId',
        code: { $first: '$code' },
        redemptions: { $sum: 1 },
        revenue:  { $sum: '$subtotalInr' },
        discount: { $sum: '$discountInr' },
      }},
      { $sort: { revenue: -1 } },
    ]).toArray(),
    db.collection(REDEMPTIONS_COL).countDocuments(match),
  ]);
  // Enrich with influencerName from coupons collection
  const coupons = await db.collection(COL).find({ id: { $in: byCoupon.map((b) => b._id).filter(Boolean) } }).toArray();
  const nameByCoupon = {};
  for (const c of coupons) nameByCoupon[c.id] = { influencerName: c.influencerName, campaign: c.campaign };

  return {
    totalRedemptions: totalReds,
    totalRevenueInr:  byCoupon.reduce((s, r) => s + r.revenue,  0),
    totalDiscountInr: byCoupon.reduce((s, r) => s + r.discount, 0),
    perCoupon: byCoupon.map((b) => ({
      couponId: b._id,
      code: b.code,
      influencerName: nameByCoupon[b._id]?.influencerName || '',
      campaign:       nameByCoupon[b._id]?.campaign       || '',
      redemptions: b.redemptions,
      revenue:  b.revenue,
      discount: b.discount,
    })),
  };
}

export async function listRedemptions({ couponId = null, customerId = null, limit = 100 } = {}) {
  const db = await getDb();
  const q = {};
  if (couponId)   q.couponId   = couponId;
  if (customerId) q.customerId = customerId;
  const docs = await db.collection(REDEMPTIONS_COL).find(q).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}
