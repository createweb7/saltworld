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

  // ------- Customer auth (public phone + OTP) -------
  if (segs[0] === 'customer' && segs[1] === 'auth') {
    const { issueOtp, verifyOtp, upsertCustomerByPhone, signCustomerToken, setCustomerCookie, clearCustomerCookie, getCurrentCustomer } = await import('@/lib/customer-auth');

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
      const doc = {
        id: randomUUID(),
        ref,
        outcome:      body.outcome      || null,
        outcomeLabel: body.outcomeLabel || null,
        therapy:      body.therapy      || null,
        therapyLabel: body.therapyLabel || null,
        therapies:    Array.isArray(body.therapies) ? body.therapies : (body.therapy ? [{ slug: body.therapy, label: body.therapyLabel, role: 'Primary' }] : []),
        slotDate:   body.slotDate   || null,
        slotTime:   body.slotTime   || null,
        guests:     body.guests     || 1,
        contact:    body.contact    || {},
        customerId: body.customerId || null,
        branchId,
        payment:    body.payment    || 'at-visit',
        priceLine:  body.priceLine  || null,
        total:      body.total      || 0,
        status:     'confirmed',
        createdAt:  now.toISOString(),
      };
      await bookings.insertOne(doc);

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
