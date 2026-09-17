import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { toBooking, toBookingFull, toPage, toTherapy } from '@/lib/db-mappers';
import { TEMPLATES, getTemplate, emptyPage } from '@/lib/templates';
import { randomUUID } from 'crypto';
import { adminHandle } from '@/lib/api/admin';
import {
  createOrder as rpCreateOrder,
  verifySignature as rpVerifySignature,
  verifyWebhookSignature as rpVerifyWebhook,
  razorpayIsConfigured,
  getPublicKeyId,
} from '@/lib/razorpay';
import { sendWhatsappTemplate, whatsappIsConfigured } from '@/lib/whatsapp';

const slugify = (s) => (s || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The `next dev --hostname 0.0.0.0` bind address can leak into
// `req.url`'s origin instead of the Host header the browser actually
// sent, which breaks anything (like Google OAuth redirect_uri) that
// must match what's in front of the user. Trust the Host header first.
function requestOrigin(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('0.0.0.0') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

async function uniqueSlug(supabase, base) {
  let slug = base, i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase.from('pages').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${++i}`;
  }
}

async function handle(req, method, segs) {
  // Delegate admin sub-router
  if (segs[0] === 'admin') {
    return adminHandle(req, method, segs.slice(1));
  }

  const supabase = getSupabase();

  // ------- Leads (Corporate / General) -------
  if (segs[0] === 'leads') {
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const now = new Date();
      const doc = {
        id: randomUUID(),
        name:     body.name    || '',
        email:    body.email   || '',
        company:  body.company || '',
        teamSize: body.teamSize|| '',
        notes:    body.notes   || '',
        source:   body.source  || 'unknown',
        status:   'new',
        createdAt: now.toISOString(),
      };
      if (!doc.email || !doc.name) {
        return NextResponse.json({ error: 'name_email_required' }, { status: 400 });
      }
      const { error } = await supabase.from('leads').insert({
        id: doc.id, name: doc.name, email: doc.email, company: doc.company, team_size: doc.teamSize,
        notes: doc.notes, source: doc.source, status: doc.status, created_at: doc.createdAt,
      });
      if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
      return NextResponse.json(doc);
    }
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
      return NextResponse.json((rows || []).map((r) => ({
        ...r.data, id: r.id, name: r.name, email: r.email, company: r.company, teamSize: r.team_size,
        notes: r.notes, source: r.source, status: r.status, createdAt: r.created_at,
      })));
    }
  }

  // ------- Public mini-blogs (homepage strip) -------
  if (segs[0] === 'mini-blogs' && segs.length === 1 && method === 'GET') {
    const { data: rows } = await supabase.from('mini_blog_posts').select('*')
      .eq('status', 'published').order('order', { ascending: true }).order('created_at', { ascending: false }).limit(24);
    return NextResponse.json((rows || []).map((r) => ({
      ...r.data, id: r.id, status: r.status, order: r.order, createdAt: r.created_at, updatedAt: r.updated_at,
    })));
  }

  // ------- Public outcome→therapy mapping (used by /book step 2) -------
  if (segs[0] === 'outcome-mapping' && segs.length === 2 && method === 'GET') {
    const { data: row } = await supabase.from('outcome_therapy_map').select('*')
      .eq('outcome_slug', segs[1]).neq('active', false).maybeSingle();
    if (!row) return NextResponse.json({ error: 'not_configured' }, { status: 404 });
    return NextResponse.json({
      ...row.data, id: row.id, outcomeSlug: row.outcome_slug, active: row.active,
      createdAt: row.created_at, updatedAt: row.updated_at,
    });
  }

  // ------- Public memberships (plans, customer subs, purchase) -------
  // GET /api/customer/me — used by the header widget to render sign-in state.
  if (segs[0] === 'customer' && segs[1] === 'me' && method === 'GET') {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ customer: null }, { status: 200 });
    return NextResponse.json({ customer: {
      id: customer.id, name: customer.name || '', email: customer.email || '',
      phone: customer.phone || '', picture: customer.picture || '',
      walletBalance: customer.walletBalance || 0,
    } });
  }

  // PATCH /api/customer/me — self-service profile update (name/email), used
  // by the membership purchase flow to collect invoice details inline
  // instead of bouncing the customer to a separate account page.
  if (segs[0] === 'customer' && segs[1] === 'me' && method === 'PATCH') {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const email = typeof body.email === 'string' ? body.email.trim() : undefined;
    if (email !== undefined && email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (Object.keys(patch).length > 0) {
      await supabase.from('customers').update(patch).eq('id', customer.id);
    }
    const { data: after } = await supabase.from('customers').select('*').eq('id', customer.id).maybeSingle();
    return NextResponse.json({ ok: true, customer: {
      id: after.id, name: after.name || '', email: after.email || '',
      phone: after.phone || '', picture: after.picture || '',
      walletBalance: Number(after.wallet_balance) || 0,
    } });
  }

  // ------- Customer Gift Cards (claim / list) -------
  if (segs[0] === 'customer' && segs[1] === 'giftcards') {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const customer = await getCurrentCustomer();

    // POST /api/customer/giftcards/claim  body { code, pin }
    if (segs[2] === 'claim' && method === 'POST') {
      if (!customer) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
      const body = await req.json().catch(() => ({}));
      const code = String(body.code || '').trim().toUpperCase();
      const pin  = String(body.pin  || '').trim();
      if (!code || !pin) return NextResponse.json({ error: 'code_and_pin_required' }, { status: 400 });
      const { data: gc } = await supabase.from('giftcards').select('*').eq('code', code).maybeSingle();
      if (!gc)             return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (gc.pin && gc.pin !== pin) return NextResponse.json({ error: 'invalid_pin' }, { status: 403 });
      if (gc.status !== 'active')   return NextResponse.json({ error: `card_${gc.status}` }, { status: 400 });
      if (gc.expires_at && new Date(gc.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'expired' }, { status: 400 });
      if (gc.claimed_by_customer_id && gc.claimed_by_customer_id !== customer.id) {
        return NextResponse.json({ error: 'already_claimed' }, { status: 400 });
      }
      await supabase.from('giftcards').update({
        claimed_by_customer_id: customer.id, claimed_at: new Date().toISOString(),
      }).eq('id', gc.id);
      const { data: after } = await supabase.from('giftcards').select('*').eq('id', gc.id).single();
      const { pin: _p, data, ...rest } = after;
      return NextResponse.json({ ok: true, giftcard: {
        ...data, id: rest.id, code: rest.code, balance: rest.balance, status: rest.status,
        claimedByCustomerId: rest.claimed_by_customer_id, claimedAt: rest.claimed_at, expiresAt: rest.expires_at,
        createdAt: rest.created_at, updatedAt: rest.updated_at,
      } });
    }

    // GET /api/customer/giftcards → all cards owned by this customer
    if (segs.length === 2 && method === 'GET') {
      if (!customer) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
      const { data: rows } = await supabase.from('giftcards').select('*').eq('claimed_by_customer_id', customer.id).order('created_at', { ascending: false });
      return NextResponse.json((rows || []).map(({ pin, data, ...r }) => ({
        ...data, id: r.id, code: r.code, balance: r.balance, status: r.status,
        claimedByCustomerId: r.claimed_by_customer_id, claimedAt: r.claimed_at, expiresAt: r.expires_at,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })));
    }
  }

  // ------- Unified Pricing Engine — POST /api/pricing/quote -------
  // Body: { therapies:[{slug}], customerId?, phone?, branchId?, atIso?,
  //         membershipSubscriptionId?, walletUseInr?, couponCode?,
  //         giftCardCode?, giftCardPin? }
  // Returns { lines, baseSubtotalInr, discounts:{membership,wallet,coupon,giftCard},
  //           payableInr, currency, errors[] }
  // Pure calculator — no DB writes. Safe to call as often as needed.
  if (segs[0] === 'pricing' && segs[1] === 'quote' && method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const { computeQuote } = await import('@/lib/pricing');
    const quote = await computeQuote({
      therapies:  Array.isArray(body.therapies) ? body.therapies : [],
      customerId: body.customerId || null,
      phone:      body.phone      || null,
      branchId:   body.branchId   || null,
      atIso:      body.atIso      || null,
      membershipSubscriptionId: body.membershipSubscriptionId || null,
      walletUseInr:             Number(body.walletUseInr) || 0,
      couponCode:               body.couponCode  || null,
      giftCardCode:             body.giftCardCode|| null,
      giftCardPin:              body.giftCardPin || null,
      guests:                   Math.max(1, Number(body.guests) || 1),
    });
    return NextResponse.json(quote);
  }

  // ------- Coupons (validate at checkout) -------
  if (segs[0] === 'coupons' && segs[1] === 'validate' && method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const { getByCode, validateCoupon } = await import('@/lib/coupons');
    const coupon = await getByCode(body.code || '');
    if (!coupon) return NextResponse.json({ ok: false, error: 'not_found', message: 'Coupon code is invalid.' }, { status: 200 });
    // Resolve every phone the caller might be identified by — direct input,
    // linked customer record, and normalise formatting (strip +91, spaces).
    const phones = new Set();
    const addPhone = (p) => {
      if (!p) return;
      const raw = String(p).trim();
      if (raw) phones.add(raw);
      const digits = raw.replace(/\D/g, '');
      if (digits) phones.add(digits);
      if (digits.length > 10) phones.add(digits.slice(-10));
    };
    addPhone(body.phone);
    if (body.customerId) {
      const { data: cust } = await supabase.from('customers').select('phone').eq('id', body.customerId).maybeSingle();
      if (cust?.phone) addPhone(cust.phone);
    }
    // Count non-cancelled prior bookings by customerId OR any known phone.
    let customerBookingsCount = 0;
    const ors = [];
    if (body.customerId) ors.push(`customer_id.eq.${body.customerId}`);
    if (phones.size > 0) ors.push(`contact_phone.in.(${[...phones].join(',')})`);
    if (ors.length > 0) {
      const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
        .neq('status', 'cancelled').or(ors.join(','));
      customerBookingsCount = count || 0;
    }
    const result = await validateCoupon(coupon, {
      subtotalInr: Number(body.subtotalInr) || 0,
      therapies:   Array.isArray(body.therapies) ? body.therapies : [],
      branchId:    body.branchId || null,
      customerId:  body.customerId || null,
      customerBookingsCount,
    });
    return NextResponse.json(result);
  }

  if (segs[0] === 'memberships') {
    // GET /api/memberships → all active plans (public catalog)
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('memberships').select('*').neq('active', false);
      const docs = (rows || [])
        .map((r) => ({ ...r.plan, id: r.id, slug: r.slug, name: r.name, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at }))
        .sort((a, b) => (Number(a.order) || 100) - (Number(b.order) || 100) || (Number(a.price) || 0) - (Number(b.price) || 0));
      return NextResponse.json(docs);
    }
    // GET /api/memberships/:slug → one plan by slug OR id
    if (segs.length === 2 && method === 'GET') {
      let query = supabase.from('memberships').select('*').neq('active', false);
      query = UUID_RE.test(segs[1]) ? query.or(`slug.eq.${segs[1]},id.eq.${segs[1]}`) : query.eq('slug', segs[1]);
      const { data: row } = await query.maybeSingle();
      if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ ...row.plan, id: row.id, slug: row.slug, name: row.name, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at });
    }
    // POST /api/memberships/purchase → { planId, paymentMethod:'online'|'offline', razorpayPaymentId? }
    // For online path, the caller has already completed a Razorpay checkout via a
    // pre-purchase order (see /api/payments/create-membership-order below).
    if (segs[1] === 'purchase' && method === 'POST') {
      const { getCurrentCustomer } = await import('@/lib/customer-auth');
      const customer = await getCurrentCustomer();
      if (!customer) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
      // Memberships tie to an invoice-worthy customer record — require name +
      // email on file before we activate anything. The customer detail page
      // shows a "Complete your profile" CTA when this check would fail.
      const hasProfile = Boolean(customer?.name?.trim()) && Boolean(customer?.email?.trim());
      if (!hasProfile) {
        return NextResponse.json({
          error: 'profile_incomplete',
          message: 'Please add your name and email to your profile before purchasing a membership.',
        }, { status: 422 });
      }
      const body = await req.json().catch(() => ({}));
      if (!body.planId) return NextResponse.json({ error: 'plan_required' }, { status: 400 });
      // Online purchases MUST prove a real, signature-verified Razorpay
      // payment — never trust a bare "online" claim from the client, or
      // anyone could grant themselves an active (unpaid) membership.
      let paymentRef = null;
      if (body.paymentMethod === 'online') {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          return NextResponse.json({ error: 'payment_proof_required' }, { status: 400 });
        }
        const valid = await rpVerifySignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
        if (!valid) return NextResponse.json({ error: 'signature_mismatch' }, { status: 400 });
        paymentRef = razorpay_payment_id;
      }
      try {
        const { grantSubscription } = await import('@/lib/memberships');
        const sub = await grantSubscription({
          customerId: customer.id,
          planId: body.planId,
          payment: { method: body.paymentMethod || 'offline', ref: paymentRef },
        });
        return NextResponse.json({ ok: true, subscription: sub });
      } catch (e) {
        return NextResponse.json({ error: e.message || 'purchase_failed' }, { status: 400 });
      }
    }
  }

  // POST /api/payments/create-membership-order → { planId }
  // Mints a Razorpay order for a membership plan's price, for the client to
  // open Checkout against. On success, /api/memberships/purchase is called
  // with the resulting razorpay_order_id/payment_id/signature, which are
  // verified server-side before the subscription is actually activated.
  if (segs[0] === 'payments' && segs[1] === 'create-membership-order' && method === 'POST') {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (!body.planId) return NextResponse.json({ error: 'plan_required' }, { status: 400 });
    if (!(await razorpayIsConfigured())) {
      return NextResponse.json({ error: 'razorpay_not_configured' }, { status: 503 });
    }
    const { data: planRow } = await supabase.from('memberships').select('*').eq('id', body.planId).maybeSingle();
    if (!planRow) return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });
    const price = Number(planRow.plan?.price) || 0;
    if (price <= 0) return NextResponse.json({ error: 'invalid_plan_price' }, { status: 400 });
    try {
      const order = await rpCreateOrder({
        amountPaise: Math.round(price * 100),
        currency: 'INR',
        receipt: `MEM-${String(body.planId).slice(0, 24)}`,
        notes: { planId: body.planId, planName: planRow.name, customerId: customer.id },
      });
      const keyId = await getPublicKeyId();
      return NextResponse.json({ order: { id: order.id, amount: order.amount, currency: order.currency }, keyId });
    } catch (e) {
      console.error('razorpay membership order create failed', e);
      return NextResponse.json({ error: 'razorpay_error', details: String(e?.message || e) }, { status: 502 });
    }
  }

  // ------- Customer subscriptions (signed-in) -------
  if (segs[0] === 'customer' && segs[1] === 'subscriptions') {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const { toSubscription } = await import('@/lib/db-mappers');
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
    if (segs.length === 2 && method === 'GET') {
      const { data: rows } = await supabase.from('member_subscriptions').select('*').eq('customer_id', customer.id).order('starts_at', { ascending: false });
      return NextResponse.json((rows || []).map(toSubscription));
    }
    // Membership-aware booking: return subscriptions that cover the requested
    // therapies + branch, still active, with remaining sessions. Used by the
    // booking flow to render the "Use my membership" toggle.
    if (segs.length === 3 && segs[2] === 'eligible' && method === 'GET') {
      const u = new URL(req.url);
      const therapies = (u.searchParams.get('therapies') || '')
        .split(',').map((s) => s.trim()).filter(Boolean);
      const branchId  = u.searchParams.get('branchId') || null;
      const atIso     = u.searchParams.get('atIso') || null;

      const { validateForBooking } = await import('@/lib/memberships');
      const { data: activeRows } = await supabase.from('member_subscriptions').select('*')
        .eq('customer_id', customer.id).eq('status', 'active').order('expires_at', { ascending: true });
      const active = (activeRows || []).map(toSubscription);

      const results = [];
      for (const sub of active) {
        // A sub is "eligible" only if it covers EVERY selected therapy AND
        // has enough sessions (or is unlimited/wallet).
        const perTherapy = [];
        let allOk = true;
        for (const t of therapies) {
          const r = await validateForBooking({
            subscription: sub, therapySlug: t, branchId, atIso,
          });
          perTherapy.push({ therapySlug: t, ...r });
          if (!r.ok) allOk = false;
        }
        // For 'sessions' plans, ensure we actually have >= therapies.length remaining.
        const plan = sub.planSnapshot || {};
        const willConsume = therapies.length || 1;
        if (plan.type === 'sessions' && (sub.sessionsRemaining || 0) < willConsume) {
          allOk = false;
          perTherapy.push({ therapySlug: '*', ok: false, reason: 'insufficient_sessions_for_journey' });
        }
        if (allOk) {
          results.push({ subscription: sub, perTherapy, willConsume });
        }
      }
      return NextResponse.json({ therapies, eligible: results });
    }
    const sid = segs[2];
    if (sid && segs[3] === 'usage' && method === 'GET') {
      // Verify ownership via the subscription row (membership_usage has no
      // customer_id column of its own), then list its usage.
      const { data: subRow } = await supabase.from('member_subscriptions').select('id').eq('id', sid).eq('customer_id', customer.id).maybeSingle();
      if (!subRow) return NextResponse.json([]);
      const { data: rows } = await supabase.from('membership_usage').select('*').eq('subscription_id', sid).order('consumed_at', { ascending: false }).limit(50);
      return NextResponse.json((rows || []).map((r) => ({
        ...r.data, id: r.id, subscriptionId: r.subscription_id, bookingId: r.booking_id,
        therapySlug: r.therapy_slug, consumedAt: r.consumed_at,
      })));
    }
    if (sid && segs[3] === 'freeze' && method === 'POST') {
      try {
        const { freezeSubscription } = await import('@/lib/memberships');
        const { data: sub } = await supabase.from('member_subscriptions').select('id').eq('id', sid).eq('customer_id', customer.id).maybeSingle();
        if (!sub) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const after = await freezeSubscription({ subscriptionId: sid, actorId: customer.id, reason: 'customer_freeze' });
        return NextResponse.json({ ok: true, subscription: after });
      } catch (e) { return NextResponse.json({ error: e.message || 'freeze_failed' }, { status: 400 }); }
    }
    if (sid && segs[3] === 'unfreeze' && method === 'POST') {
      try {
        const { unfreezeSubscription } = await import('@/lib/memberships');
        const { data: sub } = await supabase.from('member_subscriptions').select('id').eq('id', sid).eq('customer_id', customer.id).maybeSingle();
        if (!sub) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const after = await unfreezeSubscription({ subscriptionId: sid, actorId: customer.id });
        return NextResponse.json({ ok: true, subscription: after });
      } catch (e) { return NextResponse.json({ error: e.message || 'unfreeze_failed' }, { status: 400 }); }
    }
  }

  // ------- Public scheduling engine (single source of truth) -------
  if (segs[0] === 'scheduling' && segs[1] === 'slots' && method === 'GET') {
    const u = new URL(req.url);
    const therapies = (u.searchParams.get('therapies') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const branchId = u.searchParams.get('branchId') || null;
    const date = u.searchParams.get('date');
    const sessionMode = u.searchParams.get('sessionMode') || null;
    const floatDurationMin = Number(u.searchParams.get('floatDurationMin')) || null;
    const guests = Math.max(1, Number(u.searchParams.get('guests')) || 1);
    if (therapies.length === 0) return NextResponse.json({ error: 'therapies_required' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });
    const durationOverrides = floatDurationMin && therapies.includes('float-therapy')
      ? { 'float-therapy': floatDurationMin } : null;
    const { availableJourneySlots } = await import('@/lib/scheduling');
    const r = await availableJourneySlots({ therapySlugs: therapies, branchId, dateIso: date, sessionMode, durationOverrides, guests });
    return NextResponse.json(r || { groups: { morning: [], afternoon: [], evening: [] }, totalDurationMin: 0, totalVisitMin: 0 });
  }

  // Concierge-style recommender — returns Top N intelligently-ranked
  // complete wellness journeys based on the customer's preferred start time.
  //   ?therapies=slug1,slug2 &date=YYYY-MM-DD &preferred=HH:MM
  //   &branchId=... &sessionMode=single|couple &limit=3 &offset=0 &window=60
  if (segs[0] === 'scheduling' && segs[1] === 'recommendations' && method === 'GET') {
    const u = new URL(req.url);
    const therapiesQ = u.searchParams.get('therapies');
    const branchId   = u.searchParams.get('branchId') || null;
    const date       = u.searchParams.get('date');
    const preferred  = u.searchParams.get('preferred');
    const sessionMode= u.searchParams.get('sessionMode') || null;
    const limit      = Math.max(1, Math.min(12, Number(u.searchParams.get('limit')) || 3));
    const offset     = Math.max(0, Number(u.searchParams.get('offset')) || 0);
    const windowMin  = Math.max(15, Math.min(240, Number(u.searchParams.get('window')) || 60));
    if (!therapiesQ) return NextResponse.json({ error: 'therapies_required' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });
    if (!preferred || !/^\d{2}:\d{2}$/.test(preferred)) {
      return NextResponse.json({ error: 'preferred_time_required', hint: 'HH:MM (24h)' }, { status: 400 });
    }
    // Semantic validation — reject values like "25:99" that pass the format regex.
    const [_ph, _pm] = preferred.split(':').map(Number);
    if (!Number.isInteger(_ph) || !Number.isInteger(_pm) || _ph < 0 || _ph > 23 || _pm < 0 || _pm > 59) {
      return NextResponse.json({ error: 'preferred_time_required', hint: 'HH:MM (24h)' }, { status: 400 });
    }
    const therapies = therapiesQ.split(',').map((s) => s.trim()).filter(Boolean);
    const floatDurationMin = Number(u.searchParams.get('floatDurationMin')) || null;
    const guests = Math.max(1, Number(u.searchParams.get('guests')) || 1);
    const durationOverrides = floatDurationMin && therapies.includes('float-therapy')
      ? { 'float-therapy': floatDurationMin } : null;
    const { recommendJourneys } = await import('@/lib/scheduling');
    const r = await recommendJourneys({
      therapySlugs: therapies, branchId, dateIso: date,
      preferredTime: preferred, windowMin, sessionMode, durationOverrides, guests, limit, startOffset: offset,
    });
    return NextResponse.json(r);
  }

  // Single-therapy slot list with optional 'after' cutoff. Used by the
  // manual-mode Wellness Journey planner to filter downstream therapy cards.
  if (segs[0] === 'scheduling' && segs[1] === 'therapy-slots' && method === 'GET') {
    const u = new URL(req.url);
    const therapy = u.searchParams.get('therapy');
    const branchId = u.searchParams.get('branchId') || null;
    const date = u.searchParams.get('date');
    const after = u.searchParams.get('after'); // 'HH:mm' local, exclusive
    const floatDurationMin = Number(u.searchParams.get('floatDurationMin')) || null;
    if (!therapy) return NextResponse.json({ error: 'therapy_required' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });
    const durationOverrides = floatDurationMin && therapy === 'float-therapy'
      ? { 'float-therapy': floatDurationMin } : null;
    const { availableJourneySlots } = await import('@/lib/scheduling');
    const r = await availableJourneySlots({ therapySlugs: [therapy], branchId, dateIso: date, durationOverrides });
    if (!r) return NextResponse.json({ groups: { morning: [], afternoon: [], evening: [] }, totalDurationMin: 0, totalVisitMin: 0 });
    if (after) {
      const filt = (arr) => arr.filter((s) => s.time >= after);
      r.groups = {
        morning:   filt(r.groups.morning),
        afternoon: filt(r.groups.afternoon),
        evening:   filt(r.groups.evening),
      };
    }
    return NextResponse.json(r);
  }

  // ------- Public therapies (used by /therapies pages + booking flow) -------
  if (segs[0] === 'therapies') {
    if (segs.length === 1 && method === 'GET') {
      // Only publish therapies that are active AND online-bookable by default
      const { data: rows } = await supabase.from('therapies').select('*').neq('active', false)
        .order('is_system', { ascending: false }).order('name', { ascending: true });
      return NextResponse.json((rows || []).map(toTherapy));
    }
    if (segs.length === 2 && method === 'GET') {
      const { data: row } = await supabase.from('therapies').select('*, therapy_resources(resource_id)').eq('slug', segs[1]).neq('active', false).maybeSingle();
      if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const rest = toTherapy(row);
      const resourceIds = (row.therapy_resources || []).map((tr) => tr.resource_id);
      // Attach linked resources by branch (public: only names & count, no ids)
      const { data: resources } = resourceIds.length
        ? await supabase.from('resources').select('branch_id').in('id', resourceIds)
        : { data: [] };
      const byBranch = {};
      for (const r of resources || []) {
        const bid = r.branch_id || 'default';
        byBranch[bid] = (byBranch[bid] || 0) + 1;
      }
      rest.resourceCountByBranch = byBranch;
      return NextResponse.json(rest);
    }
    // Slot availability: GET /api/therapies/:slug/slots?date=YYYY-MM-DD&branchId=…
    if (segs.length === 3 && segs[2] === 'slots' && method === 'GET') {
      const u = new URL(req.url);
      const date = u.searchParams.get('date');
      const branchId = u.searchParams.get('branchId') || null;
      if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });
      const { daySlots } = await import('@/lib/scheduling');
      const slots = await daySlots({ therapySlug: segs[1], branchId, dateIso: date });
      return NextResponse.json({ slug: segs[1], date, branchId, slots });
    }
  }

  // ------- Customer wallet + referrals (session-cookie protected) -------
  if (segs[0] === 'customer' && (segs[1] === 'wallet' || segs[1] === 'referrals')) {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const c = await getCurrentCustomer();
    if (!c) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
    const { customerBalance, customerHistory, referralStats, issueReferralCode } = await import('@/lib/loyalty');
    if (segs[1] === 'wallet' && method === 'GET') {
      const [balance, history] = await Promise.all([customerBalance(c.id), customerHistory(c.id, 30)]);
      return NextResponse.json({ balance, history });
    }
    if (segs[1] === 'referrals' && method === 'GET') {
      // Ensure customer has a code — issue one lazily on first fetch.
      await issueReferralCode(c.id).catch(() => {});
      return NextResponse.json(await referralStats(c.id));
    }
  }

  // ------- Customer auth (public phone + OTP) -------
  if (segs[0] === 'customer' && segs[1] === 'auth') {
    const { issueOtp, verifyOtp, upsertCustomerByPhone, upsertCustomerByEmail, signCustomerToken, setCustomerCookie, clearCustomerCookie, getCurrentCustomer } = await import('@/lib/customer-auth');

    if (segs[2] === 'request-otp' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      try {
        const { phone, otp } = await issueOtp(body.phone);
        // Try to send via WhatsApp; fall back to returning otp in LOCAL DEV
        // ONLY when not configured. This must never happen in production —
        // handing the code back in the API response lets anyone "verify"
        // as any phone number without ever owning it.
        const waConfigured = await whatsappIsConfigured();
        if (waConfigured) {
          await sendWhatsappTemplate({
            to: phone,
            templateKey: 'otp_login',
            templateName: 'otp_login',
            languageCode: 'en',
            variables: { code: otp, minutes: '5' },
            orderedVariables: ['code', 'minutes'],
          }).catch(() => {});
          return NextResponse.json({ ok: true, sent: true });
        }
        if (process.env.NODE_ENV !== 'production') {
          return NextResponse.json({ ok: true, sent: false, devOtp: otp });
        }
        return NextResponse.json({ error: 'otp_delivery_not_configured' }, { status: 503 });
      } catch (e) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
      }
    }

    if (segs[2] === 'verify-otp' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const result = await verifyOtp(body.phone, body.otp);
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      const customer = await upsertCustomerByPhone(result.phone);
      if (customer.disabled) {
        return NextResponse.json({ ok: false, error: 'account_disabled' }, { status: 403 });
      }
      const token = await signCustomerToken({ sub: customer.id, phone: customer.phone });
      await setCustomerCookie(token);
      return NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
    }

    if (segs[2] === 'me' && method === 'GET') {
      const customer = await getCurrentCustomer();
      if (!customer) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
      return NextResponse.json({ customer });
    }

    if (segs[2] === 'logout' && (method === 'POST' || method === 'GET')) {
      await clearCustomerCookie();
      // Support both fetch() calls (JSON) and native <form action> submissions (redirect).
      if (method === 'GET' || req.headers.get('accept')?.includes('text/html')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.json({ ok: true });
    }

    // ---- Google Sign-In (standard OAuth 2.0 authorization-code flow) ----
    // google-start: mint a CSRF `state`, stash it (plus an optional return
    // path, e.g. mid-booking-flow) in short-lived cookies, redirect to
    // Google's consent screen.
    if (segs[2] === 'google-start' && method === 'GET') {
      const { googleIsConfigured, buildGoogleAuthUrl } = await import('@/lib/google-auth');
      const origin = requestOrigin(req);
      if (!googleIsConfigured()) {
        return NextResponse.redirect(new URL('/account/login?error=google_not_configured', origin));
      }
      const state = randomUUID();
      const res = NextResponse.redirect(buildGoogleAuthUrl({ origin, state }));
      res.cookies.set('sw_g_state', state, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300,
      });
      // Optional return path (e.g. `/book?resume=1`) — only same-origin
      // relative paths are honoured, to prevent this becoming an open
      // redirect. google-callback reads this to bounce back to where the
      // customer started instead of always landing on /account.
      const returnTo = new URL(req.url).searchParams.get('return');
      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        res.cookies.set('sw_g_return', returnTo, {
          httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300,
        });
      }
      return res;
    }

    // google-callback: Google redirects here with ?code&state. Verify state,
    // exchange the code directly with Google (server-to-server), upsert the
    // customer by verified email, and set the same sw_customer cookie the
    // OTP flow issues.
    if (segs[2] === 'google-callback' && method === 'GET') {
      const url = new URL(req.url);
      const origin = requestOrigin(req);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const expectedState = req.cookies.get('sw_g_state')?.value;
      const returnTo = req.cookies.get('sw_g_return')?.value || '/account';
      const fail = (error) => {
        const res = NextResponse.redirect(new URL(`/account/login?error=${error}`, origin));
        res.cookies.delete('sw_g_state');
        res.cookies.delete('sw_g_return');
        return res;
      };
      if (url.searchParams.get('error')) return fail('google_denied');
      if (!code || !state || !expectedState || state !== expectedState) return fail('google_state_mismatch');
      try {
        const { exchangeGoogleCode } = await import('@/lib/google-auth');
        const profile = await exchangeGoogleCode({ code, origin });
        const customer = await upsertCustomerByEmail(profile.email, {
          name: profile.name,
          picture: profile.picture,
          source: 'google_signin',
        });
        if (customer.disabled) return fail('account_disabled');
        const token = await signCustomerToken({ sub: customer.id, email: customer.email, phone: customer.phone });
        await setCustomerCookie(token);
        const res = NextResponse.redirect(new URL(returnTo, origin));
        res.cookies.delete('sw_g_state');
        res.cookies.delete('sw_g_return');
        return res;
      } catch (e) {
        console.error('google-callback failed', e);
        return fail('google_signin_failed');
      }
    }
  }

  // ------- Public analytics config (only public IDs, no secrets) -------
  if (segs[0] === 'analytics-config' && segs.length === 1 && method === 'GET') {
    const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'analytics').maybeSingle();
    const v = row?.value || {};
    return NextResponse.json({
      gtmId:        v.gtmId        || null,
      ga4Id:        v.ga4Id        || null,
      metaPixelId:  v.metaPixelId  || null,
      googleAdsId:  v.googleAdsId  || null,
      clarityId:    v.clarityId    || null,
    });
  }

  // ------- Bookings -------
  if (segs[0] === 'bookings') {
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json();
      // Online payment requires a signed-in customer — receipts, refunds and
      // wallet credit all need to attach to a real account. The booking UI
      // already gates this client-side; this is the server-side backstop
      // against a direct API call bypassing it. Pay-at-visit stays guest-
      // friendly (staff-created bookings only ever use pay-at-visit anyway).
      if (body.payment === 'online' && !body.customerId) {
        return NextResponse.json({ error: 'login_required_for_online_payment' }, { status: 401 });
      }
      const now = new Date();
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const ref = `SW-${yy}${mm}-${rand}`;

      // Attach a branchId. Prefer explicit body.branchId (staff picking a specific
      // branch), else fall back to the current branch cookie / default branch so
      // every booking is always scoped to somewhere.
      let branchId = body.branchId || null;
      if (!branchId) {
        try {
          const { getCurrentBranchFromCookies } = await import('@/lib/branches');
          const b = await getCurrentBranchFromCookies();
          branchId = b?.id || null;
        } catch { /* fall through */ }
      }
      // Resource allocation — build a journey plan and pick free resources
      // for EACH therapy in the sequence. If the selected slot is no longer
      // free (race with another customer's booking or a fresh calendar block),
      // return HTTP 409 with a small set of nearest suggestions so the client
      // can offer them inline without restarting the flow.
      let resourceId = null;
      let resourceName = null;
      let blockedFrom = null;
      let blockedTo = null;
      let schedule = null;
      const bodyTherapies = Array.isArray(body.therapies) ? body.therapies : [];
      const therapySlugs = bodyTherapies.length > 0
        ? bodyTherapies.map((t) => t.slug).filter(Boolean)
        : (body.therapy ? [body.therapy] : []);
      // Per-therapy duration override (e.g. Float Tank's 60/90-min choice).
      // Accepted either per-line (body.therapies[].durationMin) or as a
      // top-level shorthand (body.floatDurationMin) for single-therapy bookings.
      const durationOverrides = {};
      for (const t of bodyTherapies) {
        if (t?.slug && Number(t.durationMin) > 0) durationOverrides[t.slug] = Number(t.durationMin);
      }
      if (Number(body.floatDurationMin) > 0 && therapySlugs.includes('float-therapy')) {
        durationOverrides['float-therapy'] = Number(body.floatDurationMin);
      }
      // Contact validation — email must match strict username@domain.tld
      // format (backend source of truth). Rejects bookings before we touch
      // any resource allocation.
      const contactEmail = String(body?.contact?.email || '').trim();
      if (contactEmail) {
        const { isValidEmail, EMAIL_INVALID_MESSAGE } = await import('@/lib/email-validation');
        if (!isValidEmail(contactEmail)) {
          return NextResponse.json({
            error: 'invalid_email', field: 'contact.email',
            message: EMAIL_INVALID_MESSAGE,
          }, { status: 400 });
        }
      }
      // Guest-count cap — e.g. Salt Cave max 7, Kids Salt max 3. Takes the
      // STRICTEST cap across only the SHARED-capacity therapies selected
      // (max_capacity > 1) — private, exclusive-lock therapies (capacity 1:
      // Sauna, Red Light, Cold Plunge, Float) don't consult guests in their
      // own availability check (see isResourceFree in lib/scheduling.js), so
      // a Salt Cave + Red Light combo should still allow up to 7 guests for
      // the Salt Cave leg rather than being capped at 1 by the private room.
      const requestedGuests = Math.max(1, Number(body.guests) || 1);
      if (therapySlugs.length > 0 && requestedGuests > 1) {
        const { data: capDocs } = await supabase.from('therapies').select('slug, max_capacity').in('slug', therapySlugs);
        const strictestCap = (capDocs || []).reduce((min, t) => {
          const cap = Number(t.max_capacity);
          return cap > 1 ? Math.min(min, cap) : min;
        }, Infinity);
        if (Number.isFinite(strictestCap) && requestedGuests > strictestCap) {
          return NextResponse.json({
            error: 'guest_cap_exceeded',
            message: `This selection allows up to ${strictestCap} guest${strictestCap === 1 ? '' : 's'} per booking.`,
            meta: { maxGuests: strictestCap },
          }, { status: 400 });
        }
      }
      // Float-tank session mode ('single' | 'couple'), optional
      const sessionMode = body.sessionMode || null;
      // Derive an ISO startAt: prefer explicit body.startAt, else compose from slotDate+slotTime.
      let startIso = body.startAt || null;
      if (!startIso && body.slotDate && body.slotTime) {
        startIso = `${body.slotDate}T${body.slotTime}:00+05:30`;
      }
      if (therapySlugs.length > 0 && startIso) {
        // Reject bookings whose slot has already passed. Prevents front-end
        // bypasses (stale state, direct API hits, etc.) from creating
        // past-date bookings.
        const startMs = new Date(startIso).getTime();
        if (!Number.isFinite(startMs) || startMs < Date.now()) {
          return NextResponse.json({ error: 'slot_in_past', reason: 'past_time' }, { status: 400 });
        }
        // Booking Rules gate — per-therapy lead time, next-day 9PM cutoff,
        // same-day 7PM cutoff. Same engine the frontend recommender uses.
        try {
          const { assertCanBook, assertCrossServiceBuffer } = await import('@/lib/booking-rules');
          // A multi-therapy visit can have each leg land at its OWN
          // independent start time (manual mode lets the customer pick
          // non-contiguous slots per therapy — e.g. Infrared Sauna at 12:30,
          // Float at 16:00). Check lead-time/cutoff rules per leg against
          // that leg's own therapy and start, instead of taking the
          // strictest lead time across every selected therapy and checking
          // it only against the first leg's start (which would, e.g., hold
          // a 12:30 Infrared Sauna start to Float Therapy's 90-min lead).
          const planSteps = Array.isArray(body.plan) && body.plan.length > 0
            ? body.plan
            : [{ therapySlug: therapySlugs[0], from: startIso }];
          for (const step of planSteps) {
            const stepSlug = step.therapySlug || step.slug;
            if (!stepSlug || !step.from) continue;
            const stepCheck = await assertCanBook({ therapies: [stepSlug], startIso: step.from });
            if (!stepCheck.ok) {
              return NextResponse.json({
                error: stepCheck.code || 'booking_rule_violation',
                message: stepCheck.message,
                meta: stepCheck.meta || null,
              }, { status: 400 });
            }
          }
          // Cross-service transition buffer — enforce when this customer
          // already has another booking on the same IST day.
          const journeyEndForCross = body.visitToIso
            || body.slotEndAt
            || new Date(new Date(startIso).getTime() + 60 * 60000).toISOString();
          const csCheck = await assertCrossServiceBuffer({
            therapies: therapySlugs,
            startIso,
            endIso: journeyEndForCross,
            customerId: body.customerId,
            phone: body?.contact?.phone,
          });
          if (!csCheck.ok) {
            return NextResponse.json({
              error: csCheck.code || 'cross_service_buffer',
              message: csCheck.message,
              meta: csCheck.meta || null,
            }, { status: 400 });
          }
        } catch (e) { console.error('assertCanBook failed', e); }
        try {
          const { allocateJourney, suggestNextAvailableSlots } = await import('@/lib/scheduling');
          const suppliedPlan = Array.isArray(body.plan) && body.plan.length > 0 ? body.plan : null;
          const r = await allocateJourney({ therapySlugs, branchId, startIso, sessionMode, durationOverrides, guests: requestedGuests, plan: suppliedPlan });
          if (r.ok) {
            resourceId   = r.resourceId;
            resourceName = r.resourceName;
            blockedFrom  = r.blockedFrom;
            blockedTo    = r.blockedTo;
            schedule     = r.schedule;
          } else {
            // Slot no longer available — do NOT create the booking. Suggest
            // alternatives so the customer can continue without restarting.
            const suggestions = await suggestNextAvailableSlots({
              therapySlugs, branchId, startIso, sessionMode, durationOverrides, guests: requestedGuests, limit: 5,
            }).catch(() => []);
            return NextResponse.json({
              error: 'slot_unavailable',
              reason: r.reason || 'unavailable',
              suggestions,
            }, { status: 409 });
          }
        } catch (e) { console.error('allocateJourney failed', e); }
      }

      const bookingId = randomUUID();
      const doc = {
        id: bookingId,
        ref,
        outcome:      body.outcome      || null,
        outcomeLabel: body.outcomeLabel || null,
        therapy:      body.therapy      || null,
        therapyLabel: body.therapyLabel || null,
        sessionMode: sessionMode || null,
        slotDate:   body.slotDate   || null,
        slotTime:   body.slotTime   || null,
        startAt:    startIso        || null,
        guests:     body.guests     || 1,
        contact:    body.contact    || {},
        customerId: body.customerId || null,
        bookedForOther: !!body.bookedForOther,
        branchId,
        resourceId, resourceName, blockedFrom, blockedTo,
        payment:    body.payment    || 'at-visit',
        priceLine:  body.priceLine  || null,
        total:      body.total      || 0,
        pricingBreakdown: null,
        couponCode: null, couponId: null, couponDiscount: 0,
        status:     'confirmed',
        createdAt:  now.toISOString(),
      };
      const therapyLines = bodyTherapies.length > 0 ? bodyTherapies : (body.therapy ? [{ slug: body.therapy, label: body.therapyLabel, role: 'Primary' }] : []);

      // -----------------------------------------------------------------
      // UNIFIED PRICING ENGINE — single source of truth for booking totals
      // Order: Membership → Wallet → Coupon → GiftCard (rules confirmed 05-Aug-2026)
      // -----------------------------------------------------------------
      let quote = null;
      let membershipApplied = null;
      if (therapySlugs.length > 0) {
        try {
          const { computeQuote } = await import('@/lib/pricing');
          quote = await computeQuote({
            therapies:  therapySlugs.map((slug) => ({ slug, durationMin: durationOverrides[slug] || null, sessionMode })),
            customerId: doc.customerId,
            phone:      doc.contact?.phone || null,
            branchId,
            atIso:      startIso,
            membershipSubscriptionId: body.membershipSubscriptionId || null,
            walletUseInr:             Number(body.walletUseInr) || 0,
            couponCode:               body.couponCode  || null,
            giftCardCode:             body.giftCardCode|| null,
            giftCardPin:              body.giftCardPin || null,
          });

          // If the client explicitly opted in to a membership and the quote
          // returned an error (not eligible / no sessions), surface it as 400.
          if (body.membershipSubscriptionId) {
            const memErr = (quote.errors || []).find((e) => e.step === 'membership');
            if (memErr && !quote.discounts?.membership) {
              return NextResponse.json({
                error: memErr.error || 'membership_not_eligible',
                ...memErr,
              }, { status: 400 });
            }
          }

          // Populate doc from the quote (server = source of truth, never trust client total).
          doc.total = quote.payableInr;
          doc.pricingBreakdown = {
            baseSubtotalInr: quote.baseSubtotalInr,
            lines:           quote.lines,
            discounts:       quote.discounts,
            payableInr:      quote.payableInr,
            currency:        quote.currency,
          };
          // Backwards-compatible coupon columns (used by admin UI + reports).
          if (quote.discounts?.coupon) {
            doc.couponCode     = quote.discounts.coupon.code;
            doc.couponId       = quote.discounts.coupon.couponId;
            doc.couponDiscount = quote.discounts.coupon.amountInr;
          }
          if (quote.discounts?.membership) {
            membershipApplied = {
              subscriptionId:  quote.discounts.membership.subscriptionId,
              planName:        quote.discounts.membership.planName,
              type:            quote.discounts.membership.type,
              sessionsConsumed:quote.discounts.membership.sessionsConsumed,
              coveredSlugs:    quote.discounts.membership.coveredSlugs,
            };
            doc.membershipSubscriptionId = membershipApplied.subscriptionId;
            doc.membershipApplied        = membershipApplied;
            if (doc.total === 0) {
              doc.payment   = 'membership';
              doc.priceLine = `Covered by "${membershipApplied.planName}"`;
            }
          }
          // Wallet-as-payment: when a wallet debit was applied and the payable
          // is now zero, mark the payment method 'wallet' so admins see it.
          if (quote.discounts?.wallet && doc.total === 0 && !membershipApplied) {
            doc.payment = 'wallet';
            doc.priceLine = 'Paid from wallet balance';
          }
        } catch (e) {
          console.error('pricing quote failed', e);
        }
      }

      const usedKeys = ['id','ref','outcome','outcomeLabel','therapy','therapyLabel','sessionMode','slotDate','slotTime',
        'startAt','guests','contact','customerId','bookedForOther','branchId','resourceId','resourceName','blockedFrom',
        'blockedTo','payment','priceLine','total','pricingBreakdown','couponCode','couponId','couponDiscount','status','createdAt'];
      const { error: insertErr } = await supabase.from('bookings').insert({
        id: doc.id, ref: doc.ref, branch_id: doc.branchId, customer_id: doc.customerId, booked_for_other: doc.bookedForOther,
        outcome: doc.outcome, outcome_label: doc.outcomeLabel, session_mode: doc.sessionMode,
        contact_name: doc.contact?.name || '', contact_phone: doc.contact?.phone || '', contact_email: doc.contact?.email || '',
        start_at: doc.startAt, blocked_from: doc.blockedFrom, blocked_to: doc.blockedTo, guests: doc.guests,
        status: doc.status, payment: doc.payment, total: doc.total, pricing_breakdown: doc.pricingBreakdown,
        coupon_id: doc.couponId, coupon_code: doc.couponCode, coupon_discount: doc.couponDiscount,
        primary_resource_id: doc.resourceId, primary_resource_name: doc.resourceName,
        created_at: doc.createdAt, updated_at: doc.createdAt,
        data: { ...Object.fromEntries(Object.entries(doc).filter(([k]) => !usedKeys.includes(k))), slotDate: doc.slotDate, slotTime: doc.slotTime, priceLine: doc.priceLine },
      });
      if (insertErr) {
        console.error('booking insert failed', insertErr);
        return NextResponse.json({ error: 'booking_insert_failed' }, { status: 500 });
      }
      let pos = 0;
      for (const t of therapyLines) {
        if (!t?.slug) continue;
        await supabase.from('booking_therapies').insert({
          id: randomUUID(), booking_id: bookingId, therapy_slug: t.slug, label: t.label || null, role: t.role || null,
          duration_min: durationOverrides[t.slug] || t.durationMin || null, position: pos++,
        });
      }
      let spos = 0;
      for (const s of schedule || []) {
        if (!s?.resourceId || !s?.from || !s?.to) continue;
        await supabase.from('booking_schedule_items').insert({
          id: randomUUID(), booking_id: bookingId, therapy_slug: s.therapySlug || null, resource_id: s.resourceId,
          starts_at: s.from, ends_at: s.to, position: spos++,
        });
      }

      // Commit wallet debit, gift card debit, and coupon redemption ledger.
      // Gift-card and coupon side effects apply even to guest bookings; only
      // the wallet debit requires a signed-in customer (gated internally).
      if (quote) {
        try {
          const { commitQuoteSideEffects } = await import('@/lib/pricing');
          await commitQuoteSideEffects({ quote, bookingId: doc.id, bookingRef: doc.ref, customerId: doc.customerId });
        } catch (e) { console.error('commitQuoteSideEffects failed', e); }
      }

      // If membership was applied, consume one session per therapy in the journey.
      // We do this AFTER the booking insert so consumption is only recorded
      // once we actually own the slot (allocateJourney succeeded above).
      if (membershipApplied) {
        try {
          const { consumeForBooking } = await import('@/lib/memberships');
          const { toSubscription } = await import('@/lib/db-mappers');
          // Re-fetch AFTER each consume so sessionsRemaining reflects prior calls.
          for (const t of therapySlugs) {
            const { data: subRow } = await supabase.from('member_subscriptions').select('*').eq('id', membershipApplied.subscriptionId).maybeSingle();
            if (!subRow) break;
            await consumeForBooking({
              subscription: toSubscription(subRow),
              bookingId: doc.id,
              therapySlug: t,
              branchId,
              atIso: startIso || new Date().toISOString(),
            });
          }
        } catch (e) { console.error('consumeForBooking failed', e); }
      }

      // Loyalty: award earn points for signed-in customers.
      if (doc.customerId && Number(doc.total) > 0) {
        import('@/lib/loyalty').then(({ awardBookingEarn }) => awardBookingEarn({ customerId: doc.customerId, totalInr: doc.total, bookingRef: doc.ref })).catch(() => {});
      }

      // Referral code applied at booking?
      if (body.referralCode && doc.customerId) {
        import('@/lib/loyalty').then(({ applyReferralOnBooking }) =>
          applyReferralOnBooking({ code: body.referralCode, bookingRef: doc.ref, bookingCustomerId: doc.customerId, totalInr: doc.total })
        ).catch(() => {});
      }

      // Fire the central notification engine (fire-and-forget — never blocks the response).
      import('@/lib/notifications')
        .then(({ emit, NOTIFY_EVENTS }) =>
          emit(NOTIFY_EVENTS.BOOKING_CONFIRMATION, {
            to: { phone: doc.contact?.phone, email: doc.contact?.email },
            customerId: doc.customerId,
            bookingId: doc.id,
            branchId: doc.branchId,
            context: {
              name:     doc.contact?.name || 'there',
              ref:      doc.ref,
              outcome:  doc.outcomeLabel || doc.outcome || '',
              therapy:  doc.therapyLabel || doc.therapy || '',
              date:     doc.slotDate || '',
              time:     doc.slotTime || '',
            },
          }))
        .catch(() => {});

      doc.therapies = therapyLines;
      doc.schedule = schedule;
      return NextResponse.json(doc);
    }
    if (segs[1] && method === 'GET') {
      const { data: row } = await supabase.from('bookings').select('*').eq('id', segs[1]).maybeSingle();
      if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json(await toBookingFull(supabase, row));
    }

    // Customer-initiated cancel / reschedule (cutoff enforced).
    //   POST /api/bookings/:id/cancel        body: { reason? }
    //   POST /api/bookings/:id/reschedule    body: { startAt, slotDate, slotTime, sessionMode? }
    if (segs[1] && segs[2] === 'cancel' && method === 'POST') {
      const bid = segs[1];
      const { getCurrentCustomer } = await import('@/lib/customer-auth');
      const customer = await getCurrentCustomer();
      const { data: row } = await supabase.from('bookings').select('*').eq('id', bid).maybeSingle();
      if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (!customer || row.customer_id !== customer.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (['cancelled', 'completed', 'no_show', 'in_session'].includes(row.status)) {
        return NextResponse.json({ error: `already_${row.status}` }, { status: 400 });
      }
      const { assertCustomerCanMutate } = await import('@/lib/booking-rules');
      try {
        await assertCustomerCanMutate(toBooking(row), 'cancel');
      } catch (e) {
        return NextResponse.json({ error: 'cutoff_passed', cutoff: e.cutoff, rules: e.rules }, { status: 403 });
      }
      const body = await req.json().catch(() => ({}));
      await supabase.from('bookings').update({
        status: 'cancelled', updated_at: new Date().toISOString(),
        data: { ...row.data, cancelledAt: new Date().toISOString(), cancelledBy: 'customer', cancelReason: body.reason || null },
      }).eq('id', bid);
      const { data: after } = await supabase.from('bookings').select('*').eq('id', bid).single();
      return NextResponse.json({ ok: true, booking: await toBookingFull(supabase, after) });
    }

    if (segs[1] && segs[2] === 'reschedule' && method === 'POST') {
      const bid = segs[1];
      const { getCurrentCustomer } = await import('@/lib/customer-auth');
      const customer = await getCurrentCustomer();
      const { data: row } = await supabase.from('bookings').select('*').eq('id', bid).maybeSingle();
      if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (!customer || row.customer_id !== customer.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (['cancelled', 'completed', 'no_show', 'in_session'].includes(row.status)) {
        return NextResponse.json({ error: `already_${row.status}` }, { status: 400 });
      }
      const doc = await toBookingFull(supabase, row);
      const { assertCustomerCanMutate } = await import('@/lib/booking-rules');
      try {
        await assertCustomerCanMutate(doc, 'reschedule');
      } catch (e) {
        return NextResponse.json({ error: 'cutoff_passed', cutoff: e.cutoff, rules: e.rules }, { status: 403 });
      }
      const body = await req.json().catch(() => ({}));
      let newStart = body.startAt || null;
      if (!newStart && body.slotDate && body.slotTime) newStart = `${body.slotDate}T${body.slotTime}:00+05:30`;
      if (!newStart) return NextResponse.json({ error: 'startAt_required' }, { status: 400 });
      const therapySlugs = (doc.therapies || []).map((t) => t.slug).filter(Boolean);
      const sessionMode = body.sessionMode || doc.sessionMode || null;
      // Preserve any per-therapy duration override from the original booking
      // (e.g. a 90-min Float session) — reschedule must not silently revert
      // it to the therapy's default duration.
      const durationOverrides = {};
      for (const t of (doc.therapies || [])) {
        if (t?.slug && Number(t.durationMin) > 0) durationOverrides[t.slug] = Number(t.durationMin);
      }
      // Booking-rules gate — reject reschedules that would violate lead time
      // or cutoff windows.
      {
        const { assertCanBook } = await import('@/lib/booking-rules');
        const rc = await assertCanBook({ therapies: therapySlugs, startIso: newStart });
        if (!rc.ok) {
          return NextResponse.json({
            error: rc.code || 'booking_rule_violation',
            message: rc.message, meta: rc.meta || null,
          }, { status: 400 });
        }
      }
      const { allocateJourney, suggestNextAvailableSlots } = await import('@/lib/scheduling');
      const rescheduleGuests = Math.max(1, Number(doc.guests) || 1);
      const r = await allocateJourney({ therapySlugs, branchId: doc.branchId, startIso: newStart, excludeBookingId: bid, sessionMode, durationOverrides, guests: rescheduleGuests });
      if (!r.ok) {
        const suggestions = await suggestNextAvailableSlots({ therapySlugs, branchId: doc.branchId, startIso: newStart, sessionMode, durationOverrides, guests: rescheduleGuests, limit: 5 }).catch(() => []);
        return NextResponse.json({ error: 'slot_unavailable', reason: r.reason, suggestions }, { status: 409 });
      }
      await supabase.from('bookings').update({
        start_at: newStart, session_mode: sessionMode,
        primary_resource_id: r.resourceId, primary_resource_name: r.resourceName,
        blocked_from: r.blockedFrom, blocked_to: r.blockedTo, updated_at: new Date().toISOString(),
        data: { ...row.data, slotDate: body.slotDate || newStart.slice(0, 10), slotTime: body.slotTime || newStart.slice(11, 16), rescheduledAt: new Date().toISOString(), rescheduledBy: 'customer' },
      }).eq('id', bid);
      await supabase.from('booking_schedule_items').delete().eq('booking_id', bid);
      let spos = 0;
      for (const s of r.schedule || []) {
        await supabase.from('booking_schedule_items').insert({
          id: randomUUID(), booking_id: bid, therapy_slug: s.therapySlug || null, resource_id: s.resourceId,
          starts_at: s.from, ends_at: s.to, position: spos++,
        });
      }
      const { data: after } = await supabase.from('bookings').select('*').eq('id', bid).single();
      return NextResponse.json({ ok: true, booking: await toBookingFull(supabase, after) });
    }
  }

  // ------- Public booking rules (used by customer portal to decide affordance) -------
  if (segs[0] === 'booking-rules' && method === 'GET') {
    const { loadBookingRules } = await import('@/lib/booking-rules');
    const rules = await loadBookingRules();
    return NextResponse.json(rules);
  }

  // ------- Public calendar blocks (read-only, used by client UI hints) -------
  if (segs[0] === 'calendar-blocks' && method === 'GET') {
    const u = new URL(req.url);
    const from = u.searchParams.get('from');
    const to = u.searchParams.get('to');
    const branchId = u.searchParams.get('branchId') || null;
    const { listBlocks } = await import('@/lib/calendar-blocks');
    const blocks = await listBlocks({ from, to, branchId });
    return NextResponse.json({ blocks });
  }

  // ------- Payments (Razorpay) -------
  if (segs[0] === 'payments') {
    // Public status check for the checkout button.
    if (segs[1] === 'status' && method === 'GET') {
      const configured = await razorpayIsConfigured();
      const keyId = configured ? await getPublicKeyId() : null;
      return NextResponse.json({ configured, keyId });
    }

    // Create Razorpay order. Body: { bookingId, amountPaise, notes? }
    if (segs[1] === 'create-order' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { bookingId, amountPaise, notes } = body;
      if (!bookingId) return NextResponse.json({ error: 'bookingId_required' }, { status: 400 });
      const amt = Number(amountPaise);
      if (!Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
      }
      const { data: booking } = await supabase.from('bookings').select('id, ref').eq('id', bookingId).maybeSingle();
      if (!booking) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 });

      if (!(await razorpayIsConfigured())) {
        return NextResponse.json({ error: 'razorpay_not_configured' }, { status: 503 });
      }

      let order;
      try {
        order = await rpCreateOrder({
          amountPaise: Math.round(amt),
          currency: 'INR',
          receipt: booking.ref || bookingId.slice(0, 24),
          notes: { bookingId, ref: booking.ref, ...(notes || {}) },
        });
      } catch (e) {
        console.error('razorpay order create failed', e);
        return NextResponse.json({ error: 'razorpay_error', details: String(e?.message || e) }, { status: 502 });
      }

      await supabase.from('booking_payments').insert({
        id: randomUUID(), booking_id: bookingId, provider: 'razorpay', provider_order_id: order.id,
        amount: order.amount, status: 'created', created_at: new Date().toISOString(),
        raw: { currency: order.currency },
      });

      const keyId = await getPublicKeyId();
      return NextResponse.json({ order: { id: order.id, amount: order.amount, currency: order.currency }, keyId });
    }

    // Verify signature after Checkout success
    if (segs[1] === 'verify-signature' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });
      }
      const { data: paymentRecord } = await supabase.from('booking_payments').select('*')
        .eq('booking_id', bookingId).eq('provider_order_id', razorpay_order_id).maybeSingle();
      if (!paymentRecord) {
        return NextResponse.json({ success: false, error: 'payment_record_not_found' }, { status: 404 });
      }
      const valid = await rpVerifySignature({
        orderId: paymentRecord.provider_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
      const nowIso = new Date().toISOString();
      if (!valid) {
        await supabase.from('booking_payments').update({
          status: 'signature_failed', provider_payment_id: razorpay_payment_id,
          raw: { ...paymentRecord.raw, verifiedAt: nowIso }, updated_at: nowIso,
        }).eq('id', paymentRecord.id);
        return NextResponse.json({ success: false, error: 'signature_mismatch' }, { status: 400 });
      }
      await supabase.from('booking_payments').update({
        status: 'verified', provider_payment_id: razorpay_payment_id,
        raw: { ...paymentRecord.raw, verifiedAt: nowIso }, updated_at: nowIso,
      }).eq('id', paymentRecord.id);
      const { data: bookingRow } = await supabase.from('bookings').select('data').eq('id', bookingId).maybeSingle();
      await supabase.from('bookings').update({
        payment: 'online',
        data: { ...bookingRow?.data, paymentStatus: 'paid', paymentProvider: 'razorpay', paymentId: razorpay_payment_id, paymentVerifiedAt: nowIso },
      }).eq('id', bookingId);
      return NextResponse.json({ success: true });
    }

    // Webhook — signature verified against raw body.
    if (segs[1] === 'webhook' && method === 'POST') {
      const raw = await req.text();
      const sig = req.headers.get('x-razorpay-signature') || req.headers.get('X-Razorpay-Signature');
      if (!sig) return NextResponse.json({ ok: false, error: 'missing_signature' }, { status: 400 });
      const ok = await rpVerifyWebhook(raw, sig);
      if (!ok) return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 400 });
      let payload = {};
      try { payload = JSON.parse(raw); } catch { /* noop */ }
      const event = payload?.event;
      const entity = payload?.payload?.payment?.entity;
      if (event === 'payment.captured' && entity) {
        const { data: rec } = await supabase.from('booking_payments').select('*').eq('provider_order_id', entity.order_id).maybeSingle();
        if (rec) {
          await supabase.from('booking_payments').update({
            status: 'captured', provider_payment_id: entity.id,
            raw: { ...rec.raw, capturedAt: new Date().toISOString() }, updated_at: new Date().toISOString(),
          }).eq('id', rec.id);
          if (rec.booking_id) {
            const { data: bookingRow } = await supabase.from('bookings').select('data').eq('id', rec.booking_id).maybeSingle();
            await supabase.from('bookings').update({
              data: { ...bookingRow?.data, paymentStatus: 'captured' },
            }).eq('id', rec.booking_id);
          }
        }
      } else if (event === 'payment.failed' && entity) {
        const { data: rec } = await supabase.from('booking_payments').select('raw').eq('provider_order_id', entity.order_id).maybeSingle();
        await supabase.from('booking_payments').update({
          status: 'failed', provider_payment_id: entity.id,
          raw: { ...rec?.raw, failureReason: entity.error_reason || entity.error_description }, updated_at: new Date().toISOString(),
        }).eq('provider_order_id', entity.order_id);
      }
      return NextResponse.json({ ok: true });
    }
  }

  // /api/templates
  if (segs[0] === 'templates') {
    return NextResponse.json(TEMPLATES.map(({ id, name, description, accent }) => ({ id, name, description, accent })));
  }

  // /api/pages
  if (segs[0] === 'pages') {
    // list
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('pages').select('*').order('updated_at', { ascending: false }).limit(200);
      return NextResponse.json((rows || []).map(toPage));
    }
    // create
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const tmpl = body.templateId ? getTemplate(body.templateId) : null;
      const base = tmpl
        ? { title: body.title || tmpl.name, description: tmpl.description, template: tmpl.id, sections: tmpl.build(), seo: { metaTitle: tmpl.seo.metaTitle, metaDescription: tmpl.seo.metaDescription, ogImage: '', canonical: '' } }
        : emptyPage(body.title || 'Untitled');
      base.sections = (base.sections || []).map(s => ({ id: randomUUID(), ...s }));
      const now = new Date().toISOString();
      const doc = {
        id: randomUUID(),
        slug: await uniqueSlug(supabase, slugify(base.title)),
        status: 'draft',
        ...base,
        createdAt: now, updatedAt: now, publishedAt: null,
      };
      const { id, slug, status, createdAt, updatedAt, ...rest } = doc;
      const { error } = await supabase.from('pages').insert({ id, slug, status, created_at: createdAt, updated_at: updatedAt, data: rest });
      if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
      return NextResponse.json(doc);
    }

    // /api/pages/by-slug/:slug  (public)
    if (segs[1] === 'by-slug' && segs[2] && method === 'GET') {
      const { data: row } = await supabase.from('pages').select('*').eq('slug', segs[2]).eq('status', 'published').maybeSingle();
      if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json(toPage(row));
    }

    const id = segs[1];
    if (id) {
      if (segs[2] === 'duplicate' && method === 'POST') {
        const { data: srcRow } = await supabase.from('pages').select('*').eq('id', id).maybeSingle();
        if (!srcRow) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const src = toPage(srcRow);
        const now = new Date().toISOString();
        const newTitle = `${src.title} (copy)`;
        const newId = randomUUID();
        const newSlug = await uniqueSlug(supabase, slugify(newTitle));
        const { title, id: _oldId, slug: _oldSlug, status: _oldStatus, createdAt: _c, updatedAt: _u, ...rest } = src;
        const copy = { ...rest, id: newId, slug: newSlug, title: newTitle, status: 'draft', createdAt: now, updatedAt: now, publishedAt: null };
        await supabase.from('pages').insert({ id: newId, slug: newSlug, status: 'draft', created_at: now, updated_at: now, data: { ...rest, title: newTitle, publishedAt: null } });
        return NextResponse.json(copy);
      }
      if (segs[2] === 'publish' && method === 'POST') {
        const now = new Date().toISOString();
        const { data: row } = await supabase.from('pages').select('data').eq('id', id).maybeSingle();
        await supabase.from('pages').update({ status: 'published', updated_at: now, data: { ...row?.data, publishedAt: now } }).eq('id', id);
        const { data: after } = await supabase.from('pages').select('*').eq('id', id).single();
        return NextResponse.json(toPage(after));
      }
      if (segs[2] === 'unpublish' && method === 'POST') {
        const now = new Date().toISOString();
        await supabase.from('pages').update({ status: 'draft', updated_at: now }).eq('id', id);
        const { data: after } = await supabase.from('pages').select('*').eq('id', id).single();
        return NextResponse.json(toPage(after));
      }
      if (method === 'GET') {
        const { data: row } = await supabase.from('pages').select('*').eq('id', id).maybeSingle();
        if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        return NextResponse.json(toPage(row));
      }
      if (method === 'PATCH') {
        const body = await req.json();
        const now = new Date().toISOString();
        const { data: cur } = await supabase.from('pages').select('*').eq('id', id).maybeSingle();
        if (!cur) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const dataPatch = { ...cur.data };
        for (const k of ['title', 'description', 'sections', 'seo']) if (k in body) dataPatch[k] = body[k];
        let newSlug = cur.slug;
        if (body.title && slugify(cur.data?.title) === cur.slug) newSlug = await uniqueSlug(supabase, slugify(body.title));
        if (body.slug) newSlug = await uniqueSlug(supabase, slugify(body.slug));
        await supabase.from('pages').update({ slug: newSlug, updated_at: now, data: dataPatch }).eq('id', id);
        const { data: after } = await supabase.from('pages').select('*').eq('id', id).single();
        return NextResponse.json(toPage(after));
      }
      if (method === 'DELETE') {
        await supabase.from('pages').delete().eq('id', id);
        return NextResponse.json({ ok: true });
      }
    }
  }

  if (segs[0] === 'health' || segs.length === 0) {
    return NextResponse.json({ ok: true, service: 'salt-world-builder' });
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

const route = (m) => async (req, ctx) => {
  try {
    const { path = [] } = await ctx.params;
    return await handle(req, m, path);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
};

export const GET = route('GET');
export const POST = route('POST');
export const PATCH = route('PATCH');
export const DELETE = route('DELETE');
