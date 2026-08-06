import { NextResponse } from 'next/server';
import { getDb, clean } from '@/lib/mongo';
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

async function uniqueSlug(db, base) {
  let slug = base, i = 1;
  while (await db.collection('pages').findOne({ slug })) slug = `${base}-${++i}`;
  return slug;
}

async function handle(req, method, segs) {
  // Delegate admin sub-router
  if (segs[0] === 'admin') {
    return adminHandle(req, method, segs.slice(1));
  }

  const db = await getDb();
  const col = db.collection('pages');
  const bookings = db.collection('bookings');

  // ------- Leads (Corporate / General) -------
  if (segs[0] === 'leads') {
    const leadsCol = db.collection('leads');
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
      await leadsCol.insertOne(doc);
      const { _id, ...cleanDoc } = doc;
      return NextResponse.json(cleanDoc);
    }
    if (segs.length === 1 && method === 'GET') {
      const docs = await leadsCol.find({}).sort({ createdAt: -1 }).limit(200).toArray();
      return NextResponse.json(docs.map(clean));
    }
  }

  // ------- Public mini-blogs (homepage strip) -------
  if (segs[0] === 'mini-blogs' && segs.length === 1 && method === 'GET') {
    const docs = await db.collection('mini_blog')
      .find({ status: 'published' })
      .sort({ order: 1, createdAt: -1 })
      .limit(24)
      .toArray();
    return NextResponse.json(docs.map(({ _id, ...rest }) => rest));
  }

  // ------- Public outcome→therapy mapping (used by /book step 2) -------
  if (segs[0] === 'outcome-mapping' && segs.length === 2 && method === 'GET') {
    const doc = await db.collection('outcome_therapy_map').findOne({ outcomeSlug: segs[1], active: { $ne: false } });
    if (!doc) return NextResponse.json({ error: 'not_configured' }, { status: 404 });
    const { _id, ...rest } = doc;
    return NextResponse.json(rest);
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
      const gc = await db.collection('giftcards').findOne({ code });
      if (!gc)             return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (gc.pin && gc.pin !== pin) return NextResponse.json({ error: 'invalid_pin' }, { status: 403 });
      if (gc.status !== 'active')   return NextResponse.json({ error: `card_${gc.status}` }, { status: 400 });
      if (gc.expiresAt && new Date(gc.expiresAt).getTime() < Date.now()) return NextResponse.json({ error: 'expired' }, { status: 400 });
      if (gc.claimedByCustomerId && gc.claimedByCustomerId !== customer.id) {
        return NextResponse.json({ error: 'already_claimed' }, { status: 400 });
      }
      await db.collection('giftcards').updateOne({ id: gc.id }, { $set: {
        claimedByCustomerId: customer.id,
        claimedAt: new Date().toISOString(),
      }});
      const after = await db.collection('giftcards').findOne({ id: gc.id });
      const { _id, pin: _p, ...rest } = after;
      return NextResponse.json({ ok: true, giftcard: rest });
    }

    // GET /api/customer/giftcards → all cards owned by this customer
    if (segs.length === 2 && method === 'GET') {
      if (!customer) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
      const docs = await db.collection('giftcards').find({ claimedByCustomerId: customer.id }).sort({ createdAt: -1 }).toArray();
      return NextResponse.json(docs.map(({ _id, pin, ...rest }) => rest));
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
      const cust = await db.collection('customers').findOne({ id: body.customerId }, { projection: { phone: 1 } });
      if (cust?.phone) addPhone(cust.phone);
    }
    // Count non-cancelled prior bookings by customerId OR any known phone.
    let customerBookingsCount = 0;
    const or = [];
    if (body.customerId) or.push({ customerId: body.customerId });
    if (phones.size > 0) or.push({ 'contact.phone': { $in: [...phones] } });
    if (or.length > 0) {
      customerBookingsCount = await db.collection('bookings').countDocuments({
        $or: or, status: { $nin: ['cancelled'] },
      });
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
      const docs = await db.collection('memberships').find({ active: { $ne: false } }).sort({ order: 1, price: 1 }).toArray();
      return NextResponse.json(docs.map(({ _id, ...r }) => r));
    }
    // GET /api/memberships/:slug → one plan by slug OR id
    if (segs.length === 2 && method === 'GET') {
      const doc = await db.collection('memberships').findOne({ $or: [{ slug: segs[1] }, { id: segs[1] }], active: { $ne: false } });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const { _id, ...r } = doc;
      return NextResponse.json(r);
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
      try {
        const { grantSubscription } = await import('@/lib/memberships');
        const sub = await grantSubscription({
          customerId: customer.id,
          planId: body.planId,
          payment: { method: body.paymentMethod || 'online', ref: body.razorpayPaymentId || null },
        });
        return NextResponse.json({ ok: true, subscription: sub });
      } catch (e) {
        return NextResponse.json({ error: e.message || 'purchase_failed' }, { status: 400 });
      }
    }
  }

  // ------- Customer subscriptions (signed-in) -------
  if (segs[0] === 'customer' && segs[1] === 'subscriptions') {
    const { getCurrentCustomer } = await import('@/lib/customer-auth');
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
    if (segs.length === 2 && method === 'GET') {
      const subs = await db.collection('memberSubscriptions').find({ customerId: customer.id }).sort({ startAt: -1 }).toArray();
      return NextResponse.json(subs.map(({ _id, ...r }) => r));
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
      const active = await db.collection('memberSubscriptions').find({
        customerId: customer.id, status: 'active',
      }).sort({ endAt: 1 }).toArray();

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
          const { _id, ...rest } = sub;
          results.push({
            subscription: rest,
            perTherapy,
            willConsume,
          });
        }
      }
      return NextResponse.json({ therapies, eligible: results });
    }
    const sid = segs[2];
    if (sid && segs[3] === 'usage' && method === 'GET') {
      const rows = await db.collection('membership_usage').find({ subscriptionId: sid, customerId: customer.id }).sort({ consumedAt: -1 }).limit(50).toArray();
      return NextResponse.json(rows.map(({ _id, ...r }) => r));
    }
    if (sid && segs[3] === 'freeze' && method === 'POST') {
      try {
        const { freezeSubscription } = await import('@/lib/memberships');
        const sub = await db.collection('memberSubscriptions').findOne({ id: sid, customerId: customer.id });
        if (!sub) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const after = await freezeSubscription({ subscriptionId: sid, actorId: customer.id, reason: 'customer_freeze' });
        return NextResponse.json({ ok: true, subscription: after });
      } catch (e) { return NextResponse.json({ error: e.message || 'freeze_failed' }, { status: 400 }); }
    }
    if (sid && segs[3] === 'unfreeze' && method === 'POST') {
      try {
        const { unfreezeSubscription } = await import('@/lib/memberships');
        const sub = await db.collection('memberSubscriptions').findOne({ id: sid, customerId: customer.id });
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
    if (therapies.length === 0) return NextResponse.json({ error: 'therapies_required' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });
    const { availableJourneySlots } = await import('@/lib/scheduling');
    const r = await availableJourneySlots({ therapySlugs: therapies, branchId, dateIso: date, sessionMode });
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
    const therapies = therapiesQ.split(',').map((s) => s.trim()).filter(Boolean);
    const { recommendJourneys } = await import('@/lib/scheduling');
    const r = await recommendJourneys({
      therapySlugs: therapies, branchId, dateIso: date,
      preferredTime: preferred, windowMin, sessionMode, limit, startOffset: offset,
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
    if (!therapy) return NextResponse.json({ error: 'therapy_required' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'date_required' }, { status: 400 });
    const { availableJourneySlots } = await import('@/lib/scheduling');
    const r = await availableJourneySlots({ therapySlugs: [therapy], branchId, dateIso: date });
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
    const therapiesCol = db.collection('therapies');
    if (segs.length === 1 && method === 'GET') {
      // Only publish therapies that are active AND online-bookable by default
      const docs = await therapiesCol.find({ active: { $ne: false } }).sort({ isSystem: -1, name: 1 }).toArray();
      return NextResponse.json(docs.map(({ _id, ...rest }) => rest));
    }
    if (segs.length === 2 && method === 'GET') {
      const doc = await therapiesCol.findOne({ slug: segs[1], active: { $ne: false } });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const { _id, ...rest } = doc;
      // Attach linked resources by branch (public: only names & count, no ids)
      const resources = await db.collection('resources').find({ id: { $in: rest.resourceIds || [] } }).toArray();
      const byBranch = {};
      for (const r of resources) {
        const bid = r.branchId || 'default';
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
        // Try to send via WhatsApp; fall back to returning otp in dev when not configured.
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
        // Dev fallback so testing works without provider keys.
        return NextResponse.json({ ok: true, sent: false, devOtp: otp });
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

    // ---- Emergent Auth (Google) callback finaliser ----
    // Client posts { session_id } extracted from the URL fragment. We call
    // Emergent's session-data endpoint, upsert the customer by verified email,
    // and set the same sw_customer cookie the OTP flow issues.
    if (segs[2] === 'google-complete' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const sid = body.session_id || body.sessionId;
      if (!sid) return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
      try {
        const resp = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', {
          method: 'GET',
          headers: { 'X-Session-ID': sid },
        });
        if (!resp.ok) {
          return NextResponse.json({ ok: false, error: 'emergent_session_invalid' }, { status: 401 });
        }
        const profile = await resp.json();
        const email = profile.email;
        if (!email) return NextResponse.json({ ok: false, error: 'email_required' }, { status: 400 });
        const customer = await upsertCustomerByEmail(email, {
          name: profile.name,
          picture: profile.picture,
          source: 'google_signin',
        });
        if (customer.disabled) {
          return NextResponse.json({ ok: false, error: 'account_disabled' }, { status: 403 });
        }
        const token = await signCustomerToken({ sub: customer.id, email: customer.email, phone: customer.phone });
        await setCustomerCookie(token);
        return NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, picture: customer.picture } });
      } catch (e) {
        console.error('google-complete failed', e);
        return NextResponse.json({ ok: false, error: 'emergent_upstream_error' }, { status: 502 });
      }
    }
  }

  // ------- Public analytics config (only public IDs, no secrets) -------
  if (segs[0] === 'analytics-config' && segs.length === 1 && method === 'GET') {
    const doc = await db.collection('settings').findOne({ key: 'analytics' });
    const v = doc?.value || {};
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
        try {
          const { allocateJourney, suggestNextAvailableSlots } = await import('@/lib/scheduling');
          const r = await allocateJourney({ therapySlugs, branchId, startIso, sessionMode });
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
              therapySlugs, branchId, startIso, sessionMode, limit: 5,
            }).catch(() => []);
            return NextResponse.json({
              error: 'slot_unavailable',
              reason: r.reason || 'unavailable',
              suggestions,
            }, { status: 409 });
          }
        } catch (e) { console.error('allocateJourney failed', e); }
      }

      const doc = {
        id: randomUUID(),
        ref,
        outcome:      body.outcome      || null,
        outcomeLabel: body.outcomeLabel || null,
        therapy:      body.therapy      || null,
        therapyLabel: body.therapyLabel || null,
        therapies:    bodyTherapies.length > 0 ? bodyTherapies : (body.therapy ? [{ slug: body.therapy, label: body.therapyLabel, role: 'Primary' }] : []),
        sessionMode: sessionMode || null,
        slotDate:   body.slotDate   || null,
        slotTime:   body.slotTime   || null,
        startAt:    startIso        || null,
        guests:     body.guests     || 1,
        contact:    body.contact    || {},
        customerId: body.customerId || null,
        bookedForOther: !!body.bookedForOther,
        branchId,
        // Primary (first therapy) — surfaced for calendar row rendering
        resourceId,
        resourceName,
        blockedFrom,
        blockedTo,
        // Full journey schedule with per-therapy resource assignment
        schedule,
        payment:    body.payment    || 'at-visit',
        priceLine:  body.priceLine  || null,
        total:      body.total      || 0,
        // Pricing engine breakdown — populated below
        pricingBreakdown: null,
        // Coupon fields (populated below if a valid coupon is supplied)
        couponCode:      null,
        couponId:        null,
        couponDiscount:  0,
        status:     'confirmed',
        createdAt:  now.toISOString(),
      };

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
            therapies:  therapySlugs.map((slug) => ({ slug })),
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


      await bookings.insertOne(doc);

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
          // Re-fetch AFTER each consume so sessionsRemaining reflects prior calls.
          for (const t of therapySlugs) {
            const subDoc = await db.collection('memberSubscriptions').findOne({ id: membershipApplied.subscriptionId });
            if (!subDoc) break;
            await consumeForBooking({
              subscription: subDoc,
              bookingId: doc.id,
              therapySlug: t,
              branchId,
              atIso: startIso || new Date().toISOString(),
            });
          }
        } catch (e) { console.error('consumeForBooking failed', e); }
      }


      // Coupon redemption ledger is now handled by commitQuoteSideEffects
      // (see call site above). Legacy block removed.

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

      const { _id, ...cleanDoc } = doc;
      return NextResponse.json(cleanDoc);
    }
    if (segs[1] && method === 'GET') {
      const doc = await bookings.findOne({ id: segs[1] });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const { _id, ...cleanDoc } = doc;
      return NextResponse.json(cleanDoc);
    }

    // Customer-initiated cancel / reschedule (cutoff enforced).
    //   POST /api/bookings/:id/cancel        body: { reason? }
    //   POST /api/bookings/:id/reschedule    body: { startAt, slotDate, slotTime, sessionMode? }
    if (segs[1] && segs[2] === 'cancel' && method === 'POST') {
      const bid = segs[1];
      const { getCurrentCustomer } = await import('@/lib/customer-auth');
      const customer = await getCurrentCustomer();
      const doc = await bookings.findOne({ id: bid });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (!customer || doc.customerId !== customer.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (['cancelled', 'completed', 'no_show', 'in_session'].includes(doc.status)) {
        return NextResponse.json({ error: `already_${doc.status}` }, { status: 400 });
      }
      const { assertCustomerCanMutate } = await import('@/lib/booking-rules');
      try {
        await assertCustomerCanMutate(doc, 'cancel');
      } catch (e) {
        return NextResponse.json({ error: 'cutoff_passed', cutoff: e.cutoff, rules: e.rules }, { status: 403 });
      }
      const body = await req.json().catch(() => ({}));
      await bookings.updateOne({ id: bid }, { $set: {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'customer',
        cancelReason: body.reason || null,
      }});
      const after = await bookings.findOne({ id: bid });
      const { _id, ...clean } = after;
      return NextResponse.json({ ok: true, booking: clean });
    }

    if (segs[1] && segs[2] === 'reschedule' && method === 'POST') {
      const bid = segs[1];
      const { getCurrentCustomer } = await import('@/lib/customer-auth');
      const customer = await getCurrentCustomer();
      const doc = await bookings.findOne({ id: bid });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (!customer || doc.customerId !== customer.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (['cancelled', 'completed', 'no_show', 'in_session'].includes(doc.status)) {
        return NextResponse.json({ error: `already_${doc.status}` }, { status: 400 });
      }
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
      const { allocateJourney, suggestNextAvailableSlots } = await import('@/lib/scheduling');
      const r = await allocateJourney({ therapySlugs, branchId: doc.branchId, startIso: newStart, excludeBookingId: bid, sessionMode });
      if (!r.ok) {
        const suggestions = await suggestNextAvailableSlots({ therapySlugs, branchId: doc.branchId, startIso: newStart, sessionMode, limit: 5 }).catch(() => []);
        return NextResponse.json({ error: 'slot_unavailable', reason: r.reason, suggestions }, { status: 409 });
      }
      await bookings.updateOne({ id: bid }, { $set: {
        startAt: newStart,
        slotDate: body.slotDate || newStart.slice(0, 10),
        slotTime: body.slotTime || newStart.slice(11, 16),
        sessionMode,
        resourceId: r.resourceId,
        resourceName: r.resourceName,
        blockedFrom: r.blockedFrom,
        blockedTo: r.blockedTo,
        schedule: r.schedule,
        rescheduledAt: new Date().toISOString(),
        rescheduledBy: 'customer',
      }});
      const after = await bookings.findOne({ id: bid });
      const { _id, ...clean } = after;
      return NextResponse.json({ ok: true, booking: clean });
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
      const booking = await bookings.findOne({ id: bookingId });
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

      await db.collection('bookingPayments').insertOne({
        id: randomUUID(),
        bookingId,
        razorpayOrderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: 'created',
        createdAt: new Date().toISOString(),
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
      const paymentRecord = await db.collection('bookingPayments').findOne({
        bookingId, razorpayOrderId: razorpay_order_id,
      });
      if (!paymentRecord) {
        return NextResponse.json({ success: false, error: 'payment_record_not_found' }, { status: 404 });
      }
      const valid = await rpVerifySignature({
        orderId: paymentRecord.razorpayOrderId,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
      const nowIso = new Date().toISOString();
      if (!valid) {
        await db.collection('bookingPayments').updateOne(
          { id: paymentRecord.id },
          { $set: { status: 'signature_failed', razorpayPaymentId: razorpay_payment_id, verifiedAt: nowIso } },
        );
        return NextResponse.json({ success: false, error: 'signature_mismatch' }, { status: 400 });
      }
      await db.collection('bookingPayments').updateOne(
        { id: paymentRecord.id },
        { $set: { status: 'verified', razorpayPaymentId: razorpay_payment_id, verifiedAt: nowIso } },
      );
      await bookings.updateOne(
        { id: bookingId },
        { $set: { payment: 'online', paymentStatus: 'paid', paymentProvider: 'razorpay', paymentId: razorpay_payment_id, paymentVerifiedAt: nowIso } },
      );
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
        await db.collection('bookingPayments').updateOne(
          { razorpayOrderId: entity.order_id },
          { $set: { status: 'captured', razorpayPaymentId: entity.id, capturedAt: new Date().toISOString() } },
        );
        const rec = await db.collection('bookingPayments').findOne({ razorpayOrderId: entity.order_id });
        if (rec?.bookingId) {
          await bookings.updateOne({ id: rec.bookingId }, { $set: { paymentStatus: 'captured' } });
        }
      } else if (event === 'payment.failed' && entity) {
        await db.collection('bookingPayments').updateOne(
          { razorpayOrderId: entity.order_id },
          { $set: { status: 'failed', razorpayPaymentId: entity.id, failureReason: entity.error_reason || entity.error_description, updatedAt: new Date().toISOString() } },
        );
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
      const docs = await col.find({}).sort({ updatedAt: -1 }).limit(200).toArray();
      return NextResponse.json(docs.map(clean));
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
        slug: await uniqueSlug(db, slugify(base.title)),
        status: 'draft',
        ...base,
        createdAt: now, updatedAt: now, publishedAt: null,
      };
      await col.insertOne(doc);
      return NextResponse.json(clean(doc));
    }

    // /api/pages/by-slug/:slug  (public)
    if (segs[1] === 'by-slug' && segs[2] && method === 'GET') {
      const doc = await col.findOne({ slug: segs[2], status: 'published' });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json(clean(doc));
    }

    const id = segs[1];
    if (id) {
      if (segs[2] === 'duplicate' && method === 'POST') {
        const src = await col.findOne({ id });
        if (!src) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const now = new Date().toISOString();
        const newTitle = `${src.title} (copy)`;
        const copy = {
          ...src, _id: undefined, id: randomUUID(),
          slug: await uniqueSlug(db, slugify(newTitle)),
          title: newTitle, status: 'draft', createdAt: now, updatedAt: now, publishedAt: null,
        };
        delete copy._id;
        await col.insertOne(copy);
        return NextResponse.json(clean(copy));
      }
      if (segs[2] === 'publish' && method === 'POST') {
        const now = new Date().toISOString();
        await col.updateOne({ id }, { $set: { status: 'published', publishedAt: now, updatedAt: now } });
        const doc = await col.findOne({ id });
        return NextResponse.json(clean(doc));
      }
      if (segs[2] === 'unpublish' && method === 'POST') {
        const now = new Date().toISOString();
        await col.updateOne({ id }, { $set: { status: 'draft', updatedAt: now } });
        const doc = await col.findOne({ id });
        return NextResponse.json(clean(doc));
      }
      if (method === 'GET') {
        const doc = await col.findOne({ id });
        if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        return NextResponse.json(clean(doc));
      }
      if (method === 'PATCH') {
        const body = await req.json();
        const now = new Date().toISOString();
        const $set = { updatedAt: now };
        for (const k of ['title', 'description', 'sections', 'seo']) if (k in body) $set[k] = body[k];
        if (body.title) {
          const cur = await col.findOne({ id });
          if (cur && slugify(cur.title) === cur.slug) $set.slug = await uniqueSlug(db, slugify(body.title));
        }
        if (body.slug) $set.slug = await uniqueSlug(db, slugify(body.slug));
        await col.updateOne({ id }, { $set });
        const doc = await col.findOne({ id });
        return NextResponse.json(clean(doc));
      }
      if (method === 'DELETE') {
        await col.deleteOne({ id });
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
export const PUT = route('PUT');
