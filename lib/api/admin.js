// Salt World BOS — Admin API router.
// Mounted from /app/app/api/[[...path]]/route.js under /api/admin/*.
// Auth is enforced by /app/middleware.js (except /login /forgot /reset).

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb, clean } from '@/lib/mongo';
import {
  signSession, setSessionCookie, clearSessionCookie, getCurrentUser,
} from '@/lib/auth';
import { ensureSeed, verifyPassword, hashPassword } from '@/lib/seed';
import { hasPermission, PERMISSIONS, ROLES } from '@/lib/permissions';

const ok  = (data, init = {}) => NextResponse.json(data, init);
const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

async function logActivity(db, { actorId, action, entityType, entityId, before, after }) {
  await db.collection('activityLog').insertOne({
    id: randomUUID(),
    actorId, action, entityType, entityId,
    before: before ?? null, after: after ?? null,
    createdAt: new Date().toISOString(),
  });
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, res: err('unauthenticated', 401) };
  return { user, res: null };
}

function requirePermission(user, perm) {
  if (!hasPermission(user, perm)) return err('forbidden', 403);
  return null;
}

/* ========================================================== */
/* Router                                                     */
/* ========================================================== */

export async function adminHandle(req, method, segs) {
  await ensureSeed();
  const db = await getDb();

  // ---------- Auth (public sub-routes) ----------
  if (segs[0] === 'auth') {
    if (segs[1] === 'login' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');
      if (!email || !password) return err('email_password_required', 400);
      const doc = await db.collection('users').findOne({ email, status: 'active' });
      if (!doc) return err('invalid_credentials', 401);
      const okPass = await verifyPassword(password, doc.passwordHash);
      if (!okPass) return err('invalid_credentials', 401);
      const token = await signSession({ userId: doc.id, role: doc.role });
      await setSessionCookie(token);
      await db.collection('users').updateOne(
        { id: doc.id },
        { $set: { lastLoginAt: new Date().toISOString() } }
      );
      const { _id, passwordHash, ...safe } = doc;
      return ok({ user: safe });
    }
    if (segs[1] === 'logout' && method === 'POST') {
      await clearSessionCookie();
      return ok({ ok: true });
    }
    if (segs[1] === 'me' && method === 'GET') {
      const user = await getCurrentUser();
      if (!user) return err('unauthenticated', 401);
      return ok({ user });
    }
    if (segs[1] === 'forgot' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) return err('email_required', 400);
      const doc = await db.collection('users').findOne({ email });
      // Do not leak whether email exists. Always return ok.
      if (doc) {
        const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
        await db.collection('passwordResets').insertOne({
          id: randomUUID(), token, userId: doc.id,
          expiresAt, used: false, createdAt: new Date().toISOString(),
        });
        // TODO: send email once notification module is wired. For dev, return the link.
        const devLink = `/admin/reset/${token}`;
        return ok({ ok: true, devLink });
      }
      return ok({ ok: true });
    }
    if (segs[1] === 'reset' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const token = String(body.token || '');
      const password = String(body.password || '');
      if (!token || password.length < 8) return err('invalid_input', 400);
      const rec = await db.collection('passwordResets').findOne({ token, used: false });
      if (!rec) return err('invalid_or_used_token', 400);
      if (new Date(rec.expiresAt).getTime() < Date.now()) return err('token_expired', 400);
      const passwordHash = await hashPassword(password);
      await db.collection('users').updateOne(
        { id: rec.userId },
        { $set: { passwordHash, updatedAt: new Date().toISOString() } }
      );
      await db.collection('passwordResets').updateOne(
        { id: rec.id }, { $set: { used: true, usedAt: new Date().toISOString() } }
      );
      return ok({ ok: true });
    }
  }

  // From here, an authenticated user is required.
  const { user, res: authErr } = await requireUser();
  if (authErr) return authErr;

  /* ---------- Dashboard ---------- */
  if (segs[0] === 'dashboard' && method === 'GET') {
    const permErr = requirePermission(user, PERMISSIONS.DASHBOARD_VIEW);
    if (permErr) return permErr;

    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6); weekAgo.setHours(0,0,0,0);

    const [
      bookingsToday, bookingsWeek, customersCount, leadsCount, giftcardsIssued, subsActive
    ] = await Promise.all([
      db.collection('bookings').find({ createdAt: { $gte: dayStart.toISOString() } }).toArray(),
      db.collection('bookings').find({ createdAt: { $gte: weekAgo.toISOString() } }).toArray(),
      db.collection('customers').countDocuments({}),
      db.collection('leads').countDocuments({ createdAt: { $gte: dayStart.toISOString() } }),
      db.collection('giftcards').countDocuments({ createdAt: { $gte: dayStart.toISOString() } }),
      db.collection('memberSubscriptions').countDocuments({ status: 'active' }),
    ]);

    const todayRevenue = bookingsToday.reduce((s, b) => s + (b.total || 0), 0);

    // 7-day trend (revenue per day)
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const rev = bookingsWeek
        .filter((b) => b.createdAt >= d.toISOString() && b.createdAt < next.toISOString())
        .reduce((s, b) => s + (b.total || 0), 0);
      daily.push({ date: d.toISOString().slice(0, 10), revenue: rev, bookings:
        bookingsWeek.filter((b) => b.createdAt >= d.toISOString() && b.createdAt < next.toISOString()).length
      });
    }

    // Upcoming (next 90 min from any bookings today with startAt or slotDate/slotTime)
    const nowStr = now.toISOString();
    const upcoming = await db.collection('bookings')
      .find({ status: { $in: ['booked', 'confirmed', 'checked_in'] } })
      .sort({ startAt: 1 })
      .limit(8)
      .toArray();

    return ok({
      kpis: {
        todayRevenue,
        bookingsToday: bookingsToday.length,
        walkIns: bookingsToday.filter((b) => b.source === 'walkin').length,
        pendingPayments: bookingsToday.filter((b) => b.payment === 'at-visit' || b.payment?.status === 'pending').length,
        giftcardsToday: giftcardsIssued,
        membersActive: subsActive,
        leadsToday: leadsCount,
        customersTotal: customersCount,
      },
      trend7d: daily,
      upcoming: upcoming.map(clean),
    });
  }

  /* ---------- Customers ---------- */
  if (segs[0] === 'customers') {
    const col = db.collection('customers');

    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const q = url.searchParams.get('q');
      const filter = q
        ? { $or: [
            { name:  { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } },
          ] }
        : {};
      const docs = await col.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      return ok(docs.map(clean));
    }

    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      const doc = {
        id: randomUUID(),
        name:  body.name  || '',
        email: (body.email || '').toLowerCase() || null,
        phone: body.phone || null,
        dob:   body.dob   || null,
        tags:  body.tags  || [],
        walletBalance: 0,
        emergencyContact: body.emergencyContact || null,
        medicalNotes:    body.medicalNotes || '',
        preferredTherapistId: body.preferredTherapistId || null,
        source: body.source || 'admin',
        status: 'active',
        lifetimeValue: 0,
        lastVisitAt: null,
        createdAt: now, updatedAt: now,
      };
      if (!doc.name) return err('name_required', 400);
      await col.insertOne(doc);
      await logActivity(db, {
        actorId: user.id, action: 'customer:create', entityType: 'customer',
        entityId: doc.id, after: doc,
      });
      return ok(clean(doc));
    }

    if (segs[1] === 'search' && method === 'GET') {
      const url = new URL(req.url);
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return ok([]);
      const docs = await col.find({
        $or: [
          { name:  { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
        ],
      }).limit(8).toArray();
      return ok(docs.map(clean));
    }

    const id = segs[1];
    if (id) {
      const permErrView = requirePermission(user, PERMISSIONS.CUSTOMERS_VIEW);
      if (permErrView) return permErrView;

      if (method === 'GET' && segs.length === 2) {
        const doc = await col.findOne({ id });
        if (!doc) return err('not_found', 404);
        const [visits, invoices, giftcards, subs, comms, notes] = await Promise.all([
          db.collection('visits').find({ customerId: id }).sort({ startedAt: -1 }).limit(50).toArray(),
          db.collection('invoices').find({ customerId: id }).sort({ createdAt: -1 }).limit(50).toArray(),
          db.collection('giftcards').find({ 'to.email': doc.email }).sort({ createdAt: -1 }).limit(20).toArray(),
          db.collection('memberSubscriptions').find({ customerId: id }).sort({ startAt: -1 }).toArray(),
          db.collection('communications').find({ customerId: id }).sort({ sentAt: -1 }).limit(50).toArray(),
          db.collection('notes').find({ parentType: 'customer', parentId: id }).sort({ createdAt: -1 }).toArray(),
        ]);
        return ok({
          customer: clean(doc),
          visits:   visits.map(clean),
          invoices: invoices.map(clean),
          giftcards:giftcards.map(clean),
          subscriptions: subs.map(clean),
          communications: comms.map(clean),
          notes:    notes.map(clean),
        });
      }

      if (method === 'PATCH' && segs.length === 2) {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        const before = await col.findOne({ id });
        if (!before) return err('not_found', 404);
        const $set = { updatedAt: new Date().toISOString() };
        for (const k of ['name','email','phone','dob','tags','emergencyContact','preferredTherapistId']) {
          if (k in body) $set[k] = body[k];
        }
        if ('medicalNotes' in body) {
          const permMed = requirePermission(user, PERMISSIONS.CUSTOMERS_MEDICAL);
          if (permMed) return permMed;
          $set.medicalNotes = body.medicalNotes;
        }
        await col.updateOne({ id }, { $set });
        const after = await col.findOne({ id });
        await logActivity(db, {
          actorId: user.id, action: 'customer:update', entityType: 'customer',
          entityId: id, before: clean(before), after: clean(after),
        });
        return ok(clean(after));
      }

      if (method === 'DELETE' && segs.length === 2) {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const before = await col.findOne({ id });
        if (!before) return err('not_found', 404);
        await col.deleteOne({ id });
        await logActivity(db, {
          actorId: user.id, action: 'customer:delete', entityType: 'customer',
          entityId: id, before: clean(before),
        });
        return ok({ ok: true });
      }

      if (segs[2] === 'notes' && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.body) return err('body_required', 400);
        const doc = {
          id: randomUUID(), parentType: 'customer', parentId: id,
          authorId: user.id, authorName: user.name,
          body: body.body, createdAt: new Date().toISOString(),
        };
        await db.collection('notes').insertOne(doc);
        return ok(clean(doc));
      }
    }
  }

  /* ---------- Bookings ---------- */
  if (segs[0] === 'bookings') {
    const col = db.collection('bookings');

    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q');
      const filter = {};
      if (status) filter.status = status;
      if (q) filter.$or = [
        { ref:   { $regex: q, $options: 'i' } },
        { 'contact.name':  { $regex: q, $options: 'i' } },
        { 'contact.phone': { $regex: q, $options: 'i' } },
      ];
      const docs = await col.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      return ok(docs.map(clean));
    }

    if (segs[1] === 'calendar' && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_CALENDAR);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const from = url.searchParams.get('from');
      const to   = url.searchParams.get('to');
      const filter = {};
      if (from || to) {
        filter.$or = [
          { startAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } },
          { slotDate: { ...(from && { $gte: from.slice(0,10) }), ...(to && { $lte: to.slice(0,10) }) } },
        ];
      }
      const docs = await col.find(filter).limit(400).toArray();
      return ok(docs.map(clean));
    }

    const id = segs[1];
    if (id && method === 'GET' && segs.length === 2) {
      const doc = await col.findOne({ id });
      if (!doc) {
        const doc2 = await col.findOne({ ref: id });
        if (!doc2) return err('not_found', 404);
        return ok(clean(doc2));
      }
      return ok(clean(doc));
    }

    // Status transitions
    const TRANSITIONS = {
      'check-in':  'checked_in',
      'start':     'in_session',
      'complete':  'completed',
      'no-show':   'no_show',
      'cancel':    'cancelled',
    };
    if (id && segs[2] && TRANSITIONS[segs[2]] && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_EDIT);
      if (permErr) return permErr;
      const nextStatus = TRANSITIONS[segs[2]];
      const before = await col.findOne({ id });
      if (!before) return err('not_found', 404);
      const $set = { status: nextStatus, updatedAt: new Date().toISOString() };
      if (segs[2] === 'check-in')  $set.checkedInAt  = new Date().toISOString();
      if (segs[2] === 'start')     $set.startedAt    = new Date().toISOString();
      if (segs[2] === 'complete')  $set.completedAt  = new Date().toISOString();
      await col.updateOne({ id }, { $set });
      const after = await col.findOne({ id });
      await logActivity(db, {
        actorId: user.id, action: `booking:${segs[2]}`, entityType: 'booking',
        entityId: id, before: clean(before), after: clean(after),
      });
      return ok(clean(after));
    }
  }

  /* ---------- Universal search ---------- */
  if (segs[0] === 'search' && method === 'GET') {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return ok({ customers: [], bookings: [], pages: [] });
    const [customers, bookings, pages] = await Promise.all([
      db.collection('customers').find({
        $or: [
          { name:  { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
        ],
      }).limit(6).toArray(),
      db.collection('bookings').find({
        $or: [
          { ref:   { $regex: q, $options: 'i' } },
          { 'contact.name':  { $regex: q, $options: 'i' } },
          { 'contact.phone': { $regex: q, $options: 'i' } },
        ],
      }).limit(6).toArray(),
      db.collection('pages').find({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { slug:  { $regex: q, $options: 'i' } },
        ],
      }).limit(6).toArray(),
    ]);
    return ok({
      customers: customers.map(clean),
      bookings:  bookings.map(clean),
      pages:     pages.map(clean),
    });
  }

  /* ---------- Activity log ---------- */
  if (segs[0] === 'activity' && method === 'GET') {
    const permErr = requirePermission(user, PERMISSIONS.ACTIVITY_VIEW);
    if (permErr) return permErr;
    const docs = await db.collection('activityLog').find({}).sort({ createdAt: -1 }).limit(100).toArray();
    return ok(docs.map(clean));
  }

  /* ---------- SSE stream (dashboard tick) ---------- */
  if (segs[0] === 'stream' && method === 'GET') {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        send({ type: 'hello', at: new Date().toISOString() });
        const interval = setInterval(async () => {
          try {
            const db2 = await getDb();
            const now = new Date(); now.setHours(0,0,0,0);
            const bookingsToday = await db2.collection('bookings')
              .countDocuments({ createdAt: { $gte: now.toISOString() } });
            send({ type: 'tick', at: new Date().toISOString(), bookingsToday });
          } catch (e) {
            send({ type: 'error', message: e.message });
          }
        }, 15_000);
        req.signal?.addEventListener?.('abort', () => {
          clearInterval(interval);
          try { controller.close(); } catch { /* noop */ }
        });
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  /* ---------- Users (Super Admin only) ---------- */
  if (segs[0] === 'users') {
    if (user.role !== 'super_admin') return err('forbidden', 403);
    const col = db.collection('users');
    if (segs.length === 1 && method === 'GET') {
      const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
      return ok(docs.map((d) => { const { _id, passwordHash, ...s } = d; return s; }));
    }
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (!body.email || !body.name || !body.password) return err('missing_fields', 400);
      const exists = await col.findOne({ email: body.email.toLowerCase() });
      if (exists) return err('email_exists', 400);
      const doc = {
        id: randomUUID(),
        email: body.email.toLowerCase(),
        name:  body.name,
        role:  body.role || 'reception',
        permissions: body.permissions || [],
        passwordHash: await hashPassword(body.password),
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      const { _id, passwordHash, ...safe } = doc;
      return ok(safe);
    }
  }

  /* ---------- Roles catalog (read only) ---------- */
  if (segs[0] === 'roles' && method === 'GET') {
    return ok(Object.values(ROLES).map((r) => ({
      key: r.key, label: r.label, description: r.description,
      permissions: r.permissions === '*' ? '*' : r.permissions,
    })));
  }

  /* ---------- Services (therapies / journeys / packages) ---------- */
  if (segs[0] === 'services') {
    const sub = segs[1];
    const kinds = { therapies: 'therapies', journeys: 'journeys', packages: 'packages' };
    if (!kinds[sub]) return err('unknown_service_kind', 404);
    const col = db.collection(kinds[sub]);

    if (segs.length === 2 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_VIEW);
      if (permErr) return permErr;
      const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
      return ok(docs.map(clean));
    }
    if (segs.length === 2 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name) return err('name_required', 400);
      const now = new Date().toISOString();
      const doc = {
        id: randomUUID(),
        name: body.name, slug: body.slug || slugify(body.name),
        durationMin: Number(body.durationMin) || 60,
        cleaningBufferMin: Number(body.cleaningBufferMin) || 15,
        defaultPrice: Number(body.defaultPrice) || 0,
        taxHsn: body.taxHsn || '999722',
        description: body.description || '',
        images: body.images || [],
        resourceTypes: body.resourceTypes || [],
        therapyIds: body.therapyIds || [],  // journeys only
        includes:   body.includes   || [],  // packages only
        validityDays: Number(body.validityDays) || 0, // packages only
        active: body.active !== false,
        createdAt: now, updatedAt: now,
      };
      await col.insertOne(doc);
      await logActivity(db, { actorId: user.id, action: `${sub}:create`, entityType: sub, entityId: doc.id, after: doc });
      return ok(clean(doc));
    }
    const sid = segs[2];
    if (sid && method === 'GET' && segs.length === 3) {
      const doc = await col.findOne({ id: sid });
      if (!doc) return err('not_found', 404);
      return ok(clean(doc));
    }
    if (sid && method === 'PATCH' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: sid });
      if (!before) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, ...rest } = body;
      await col.updateOne({ id: sid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
      const after = await col.findOne({ id: sid });
      await logActivity(db, { actorId: user.id, action: `${sub}:update`, entityType: sub, entityId: sid, before: clean(before), after: clean(after) });
      return ok(clean(after));
    }
    if (sid && method === 'DELETE' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: sid });
      if (!before) return err('not_found', 404);
      await col.deleteOne({ id: sid });
      await logActivity(db, { actorId: user.id, action: `${sub}:delete`, entityType: sub, entityId: sid, before: clean(before) });
      return ok({ ok: true });
    }
  }

  /* ---------- Memberships (plans + subscriptions) ---------- */
  if (segs[0] === 'memberships') {
    // /memberships                → plans
    // /memberships/subs           → subscriptions
    // /memberships/subs/:id/freeze|renew|upgrade
    if (segs[1] === 'subs') {
      const col = db.collection('memberSubscriptions');
      if (segs.length === 2 && method === 'GET') {
        const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_VIEW);
        if (permErr) return permErr;
        const docs = await col.find({}).sort({ startAt: -1 }).limit(400).toArray();
        return ok(docs.map(clean));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.customerId || !body.membershipId) return err('customer_and_plan_required', 400);
        const plan = await db.collection('memberships').findOne({ id: body.membershipId });
        if (!plan) return err('plan_not_found', 404);
        const now = new Date();
        const end = new Date(now); end.setDate(end.getDate() + (plan.validityDays || 30));
        const doc = {
          id: randomUUID(),
          customerId: body.customerId,
          membershipId: body.membershipId,
          startAt: now.toISOString(),
          endAt: end.toISOString(),
          status: 'active',
          sessionsUsed: 0,
          sessionsRemaining: plan.sessionsIncluded || 0,
          freezeHistory: [],
          createdAt: now.toISOString(),
        };
        await col.insertOne(doc);
        await logActivity(db, { actorId: user.id, action: 'membership_sub:create', entityType: 'memberSubscription', entityId: doc.id, after: doc });
        return ok(clean(doc));
      }
      const sid = segs[2];
      if (sid && segs[3] && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
        if (permErr) return permErr;
        const before = await col.findOne({ id: sid });
        if (!before) return err('not_found', 404);
        const now = new Date().toISOString();
        if (segs[3] === 'freeze') {
          await col.updateOne({ id: sid }, { $set: { status: 'frozen' }, $push: { freezeHistory: { at: now, by: user.id } } });
        } else if (segs[3] === 'unfreeze') {
          await col.updateOne({ id: sid }, { $set: { status: 'active' } });
        } else if (segs[3] === 'renew') {
          const plan = await db.collection('memberships').findOne({ id: before.membershipId });
          const end = new Date(); end.setDate(end.getDate() + (plan?.validityDays || 30));
          await col.updateOne({ id: sid }, { $set: { status: 'active', endAt: end.toISOString(), sessionsRemaining: (before.sessionsRemaining || 0) + (plan?.sessionsIncluded || 0) } });
        } else {
          return err('unknown_action', 400);
        }
        const after = await col.findOne({ id: sid });
        await logActivity(db, { actorId: user.id, action: `membership_sub:${segs[3]}`, entityType: 'memberSubscription', entityId: sid, before: clean(before), after: clean(after) });
        return ok(clean(after));
      }
    }

    // Plans
    const col = db.collection('memberships');
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_VIEW);
      if (permErr) return permErr;
      const docs = await col.find({}).sort({ price: 1 }).toArray();
      return ok(docs.map(clean));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.price) return err('name_price_required', 400);
      const doc = {
        id: randomUUID(),
        name: body.name,
        price: Number(body.price),
        billingCycle: body.billingCycle || 'monthly',
        sessionsIncluded: Number(body.sessionsIncluded) || 0,
        validityDays: Number(body.validityDays) || 30,
        perks: body.perks || [],
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      await logActivity(db, { actorId: user.id, action: 'membership:create', entityType: 'membership', entityId: doc.id, after: doc });
      return ok(clean(doc));
    }
    const mid = segs[1];
    if (mid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: mid });
      if (!before) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, ...rest } = body;
      await col.updateOne({ id: mid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
      const after = await col.findOne({ id: mid });
      await logActivity(db, { actorId: user.id, action: 'membership:update', entityType: 'membership', entityId: mid, before: clean(before), after: clean(after) });
      return ok(clean(after));
    }
    if (mid && method === 'DELETE' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: mid });
      if (!before) return err('not_found', 404);
      await col.deleteOne({ id: mid });
      await logActivity(db, { actorId: user.id, action: 'membership:delete', entityType: 'membership', entityId: mid, before: clean(before) });
      return ok({ ok: true });
    }
  }

  /* ---------- Gift Cards ---------- */
  if (segs[0] === 'giftcards') {
    const col = db.collection('giftcards');
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const filter = status ? { status } : {};
      const docs = await col.find(filter).sort({ createdAt: -1 }).limit(400).toArray();
      return ok(docs.map(clean));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_ISSUE);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const amount = Number(body.amount);
      if (!amount || amount < 100) return err('amount_required', 400);
      const code = generateGiftCode();
      const doc = {
        id: randomUUID(),
        code,
        designId: body.designId || 'halite',
        amount, balance: amount,
        from: body.from || { name: '', email: '' },
        to:   body.to   || { name: '', email: '', phone: '' },
        message: body.message || '',
        deliverAt: body.deliverAt || null,
        deliveryStatus: 'pending',
        status: 'active',
        issuedBy: user.id,
        corporateOrderId: body.corporateOrderId || null,
        expiresAt: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString(); })(),
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      await logActivity(db, { actorId: user.id, action: 'giftcard:issue', entityType: 'giftcard', entityId: doc.id, after: doc });
      return ok(clean(doc));
    }

    if (segs[1] === 'by-code' && segs[2] && method === 'GET') {
      const doc = await col.findOne({ code: String(segs[2]).toUpperCase() });
      if (!doc) return err('not_found', 404);
      return ok(clean(doc));
    }

    const gid = segs[1];
    if (gid && method === 'GET' && segs.length === 2) {
      const doc = await col.findOne({ id: gid });
      if (!doc) return err('not_found', 404);
      return ok(clean(doc));
    }
    if (gid && segs[2] === 'redeem' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_REDEEM);
      if (permErr) return permErr;
      const before = await col.findOne({ id: gid });
      if (!before) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const amt = Math.min(Number(body.amount) || before.balance, before.balance);
      if (amt <= 0) return err('nothing_to_redeem', 400);
      const newBalance = before.balance - amt;
      await col.updateOne({ id: gid }, { $set: {
        balance: newBalance,
        status: newBalance === 0 ? 'redeemed' : 'active',
        lastRedeemedAt: new Date().toISOString(),
      } });
      const after = await col.findOne({ id: gid });
      await logActivity(db, { actorId: user.id, action: 'giftcard:redeem', entityType: 'giftcard', entityId: gid, before: clean(before), after: clean(after) });
      return ok(clean(after));
    }
  }

  /* ---------- Products & Inventory ---------- */
  if (segs[0] === 'product-categories') {
    const col = db.collection('productCategories');
    if (segs.length === 1 && method === 'GET') return ok((await col.find({}).sort({ sort: 1 }).toArray()).map(clean));
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name) return err('name_required', 400);
      const doc = { id: randomUUID(), name: body.name, sort: Number(body.sort) || 0, createdAt: new Date().toISOString() };
      await col.insertOne(doc);
      return ok(clean(doc));
    }
    const cid = segs[1];
    if (cid && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      await col.deleteOne({ id: cid });
      return ok({ ok: true });
    }
  }

  if (segs[0] === 'products') {
    const col = db.collection('products');
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_VIEW);
      if (permErr) return permErr;
      const docs = await col.find({}).sort({ createdAt: -1 }).limit(400).toArray();
      return ok(docs.map(clean));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.price) return err('name_price_required', 400);
      const doc = {
        id: randomUUID(),
        sku: body.sku || `SW-${Date.now().toString(36).toUpperCase()}`,
        name: body.name,
        categoryId: body.categoryId || null,
        price: Number(body.price),
        tax: Number(body.tax) || 18,
        stock: Number(body.stock) || 0,
        lowStockAt: Number(body.lowStockAt) || 3,
        images: body.images || [],
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      await logActivity(db, { actorId: user.id, action: 'product:create', entityType: 'product', entityId: doc.id, after: doc });
      return ok(clean(doc));
    }
    const pid = segs[1];
    if (pid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: pid });
      if (!before) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, ...rest } = body;
      await col.updateOne({ id: pid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
      const after = await col.findOne({ id: pid });
      await logActivity(db, { actorId: user.id, action: 'product:update', entityType: 'product', entityId: pid, before: clean(before), after: clean(after) });
      return ok(clean(after));
    }
    if (pid && segs[2] === 'stock' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const delta = Number(body.delta);
      if (!Number.isFinite(delta)) return err('delta_required', 400);
      await col.updateOne({ id: pid }, { $inc: { stock: delta } });
      const after = await col.findOne({ id: pid });
      await logActivity(db, { actorId: user.id, action: 'product:stock', entityType: 'product', entityId: pid, after: { delta, stock: after.stock } });
      return ok(clean(after));
    }
    if (pid && method === 'DELETE' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: pid });
      if (!before) return err('not_found', 404);
      await col.deleteOne({ id: pid });
      await logActivity(db, { actorId: user.id, action: 'product:delete', entityType: 'product', entityId: pid, before: clean(before) });
      return ok({ ok: true });
    }
  }

  /* ---------- Payments & Invoices ---------- */
  if (segs[0] === 'payments') {
    const col = db.collection('payments');

    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.PAYMENTS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const filter = {};
      const method2 = url.searchParams.get('method');
      if (method2) filter.method = method2;
      const docs = await col.find(filter).sort({ createdAt: -1 }).limit(400).toArray();
      return ok(docs.map(clean));
    }

    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PAYMENTS_COLLECT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const total = Number(body.total);
      if (!total || total <= 0) return err('total_required', 400);
      const now = new Date();

      // Generate invoice for this payment (18% GST intra-Karnataka default).
      const invNumber = await nextInvoiceNumber(db);
      const gstRate = Number(body.gstRate ?? 18);
      const subtotal = Math.round((total * 100) / (100 + gstRate));
      const taxAmount = total - subtotal;
      const cgst = Math.round(taxAmount / 2);
      const sgst = taxAmount - cgst;

      const paymentDoc = {
        id: randomUUID(),
        amount: total,
        method: body.method || 'cash',
        splits: body.splits || [],
        ref: body.ref || null,
        status: 'succeeded',
        collectedBy: user.id,
        bookingId: body.bookingId || null,
        customerId: body.customerId || null,
        createdAt: now.toISOString(),
        invoiceNumber: invNumber,
      };
      await col.insertOne(paymentDoc);

      const invoice = {
        id: randomUUID(),
        number: invNumber,
        customerId: body.customerId || null,
        customerName: body.customerName || 'Guest',
        gstin: body.customerGstin || null,
        items: body.items || [{
          description: body.description || 'Session',
          qty: 1, unitPrice: subtotal, tax: gstRate, total,
        }],
        subtotal, cgst, sgst, igst: 0, total,
        paymentId: paymentDoc.id,
        paymentMethod: paymentDoc.method,
        createdAt: now.toISOString(),
      };
      await db.collection('invoices').insertOne(invoice);

      await logActivity(db, {
        actorId: user.id, action: 'payment:collect', entityType: 'payment',
        entityId: paymentDoc.id, after: { payment: paymentDoc, invoice },
      });

      return ok({ payment: clean(paymentDoc), invoice: clean(invoice) });
    }

    const pid = segs[1];
    if (pid && segs[2] === 'refund' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PAYMENTS_REFUND);
      if (permErr) return permErr;
      const before = await col.findOne({ id: pid });
      if (!before) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const amount = Math.min(Number(body.amount) || before.amount, before.amount);
      const refund = {
        id: randomUUID(),
        paymentId: pid,
        amount,
        reason: body.reason || '',
        approvedBy: user.id,
        status: 'refunded',
        createdAt: new Date().toISOString(),
      };
      await db.collection('refunds').insertOne(refund);
      await col.updateOne({ id: pid }, { $set: { status: 'refunded', refundedAmount: amount } });
      await logActivity(db, { actorId: user.id, action: 'payment:refund', entityType: 'payment', entityId: pid, before: clean(before), after: refund });
      return ok(clean(refund));
    }
  }

  if (segs[0] === 'invoices') {
    const col = db.collection('invoices');
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.INVOICES_VIEW);
      if (permErr) return permErr;
      const docs = await col.find({}).sort({ createdAt: -1 }).limit(400).toArray();
      return ok(docs.map(clean));
    }
    const iid = segs[1];
    if (iid && method === 'GET' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.INVOICES_VIEW);
      if (permErr) return permErr;
      const doc = await col.findOne({ id: iid });
      if (!doc) return err('not_found', 404);
      return ok(clean(doc));
    }
  }

  /* ---------- Reports ---------- */
  if (segs[0] === 'reports') {
    const permErr = requirePermission(user, PERMISSIONS.REPORTS_VIEW);
    if (permErr) return permErr;
    const kind = segs[1];
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - days + 1); from.setHours(0,0,0,0);

    if (kind === 'revenue' && method === 'GET') {
      const payments = await db.collection('payments')
        .find({ createdAt: { $gte: from.toISOString() }, status: { $ne: 'refunded' } })
        .toArray();
      const daily = bucketByDay(from, days, payments, (p) => p.amount || 0);
      const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const byMethod = payments.reduce((acc, p) => {
        acc[p.method || 'unknown'] = (acc[p.method || 'unknown'] || 0) + (p.amount || 0);
        return acc;
      }, {});
      return ok({ total, daily, byMethod, count: payments.length });
    }

    if (kind === 'bookings' && method === 'GET') {
      const bookings = await db.collection('bookings')
        .find({ createdAt: { $gte: from.toISOString() } })
        .toArray();
      const daily = bucketByDay(from, days, bookings, () => 1);
      const byStatus = bookings.reduce((acc, b) => {
        acc[b.status || 'unknown'] = (acc[b.status || 'unknown'] || 0) + 1;
        return acc;
      }, {});
      return ok({ total: bookings.length, daily, byStatus });
    }

    if (kind === 'occupancy' && method === 'GET') {
      const bookings = await db.collection('bookings')
        .find({ createdAt: { $gte: from.toISOString() } })
        .toArray();
      const byResource = bookings.reduce((acc, b) => {
        const r = b.resourceId || guessResourceFromBooking(b);
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
      return ok({ byResource, total: bookings.length });
    }

    return err('unknown_report', 404);
  }

  /* ---------- Marketing ---------- */
  if (segs[0] === 'marketing') {
    // /marketing/announcements    CRUD (bar + popup)
    // /marketing/campaigns        CRUD
    // /marketing/reviews          CRUD + /:id/reply
    // /marketing/testimonials     CRUD (curated public reviews)
    const sub = segs[1];
    const kinds = {
      announcements: 'announcements',
      campaigns: 'campaigns',
      reviews: 'reviews',
      testimonials: 'testimonials',
    };
    if (!kinds[sub]) return err('unknown_marketing_kind', 404);
    const col = db.collection(kinds[sub]);
    const permView = requirePermission(user, PERMISSIONS.DASHBOARD_VIEW);
    if (permView) return permView;

    if (segs.length === 2 && method === 'GET') {
      const docs = await col.find({}).sort({ createdAt: -1 }).limit(400).toArray();
      return ok(docs.map(clean));
    }
    if (segs.length === 2 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const doc = {
        id: randomUUID(),
        ...body,
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      await logActivity(db, { actorId: user.id, action: `${sub}:create`, entityType: sub, entityId: doc.id, after: doc });
      return ok(clean(doc));
    }
    const mid = segs[2];
    if (mid && method === 'PATCH' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: mid });
      if (!before) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, ...rest } = body;
      await col.updateOne({ id: mid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
      const after = await col.findOne({ id: mid });
      await logActivity(db, { actorId: user.id, action: `${sub}:update`, entityType: sub, entityId: mid, before: clean(before), after: clean(after) });
      return ok(clean(after));
    }
    if (mid && method === 'DELETE' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const before = await col.findOne({ id: mid });
      if (!before) return err('not_found', 404);
      await col.deleteOne({ id: mid });
      await logActivity(db, { actorId: user.id, action: `${sub}:delete`, entityType: sub, entityId: mid, before: clean(before) });
      return ok({ ok: true });
    }
  }

  /* ---------- CMS: Media library + Blog posts ---------- */
  if (segs[0] === 'cms') {
    if (segs[1] === 'media') {
      const col = db.collection('mediaAssets');
      if (segs.length === 2 && method === 'GET') {
        const docs = await col.find({}).sort({ createdAt: -1 }).limit(400).toArray();
        return ok(docs.map(clean));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        // Accept multipart file OR a URL registration.
        const ct = req.headers.get('content-type') || '';
        let doc;
        if (ct.includes('multipart/form-data')) {
          const form = await req.formData();
          const file = form.get('file');
          if (!file) return err('file_required', 400);
          const arrayBuffer = await file.arrayBuffer();
          const { uploadBuffer } = await import('@/lib/s3');
          const up = await uploadBuffer({
            buffer: Buffer.from(arrayBuffer),
            mime: file.type || 'application/octet-stream',
            filename: file.name || 'file',
          });
          doc = {
            id: randomUUID(),
            url: up.url, key: up.key, storage: up.storage,
            mime: file.type || 'application/octet-stream',
            sizeKb: Math.round((file.size || 0) / 1024),
            alt: String(form.get('alt') || ''),
            uploadedBy: user.id,
            createdAt: new Date().toISOString(),
          };
        } else {
          const body = await req.json().catch(() => ({}));
          if (!body.url) return err('url_required', 400);
          doc = {
            id: randomUUID(),
            url: body.url, key: body.key || null, storage: 'external',
            mime: body.mime || 'image/*',
            sizeKb: Number(body.sizeKb) || 0,
            alt: body.alt || '',
            uploadedBy: user.id,
            createdAt: new Date().toISOString(),
          };
        }
        await col.insertOne(doc);
        await logActivity(db, { actorId: user.id, action: 'media:upload', entityType: 'mediaAsset', entityId: doc.id, after: doc });
        return ok(clean(doc));
      }
      const aid = segs[2];
      if (aid && method === 'DELETE') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        await col.deleteOne({ id: aid });
        return ok({ ok: true });
      }
    }

    if (segs[1] === 'blog') {
      const col = db.collection('blog');
      if (segs.length === 2 && method === 'GET') {
        const docs = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray();
        return ok(docs.map(clean));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.title) return err('title_required', 400);
        const now = new Date().toISOString();
        const doc = {
          id: randomUUID(),
          title: body.title,
          slug: body.slug || slugify(body.title),
          excerpt: body.excerpt || '',
          body: body.body || '',
          coverUrl: body.coverUrl || '',
          author: body.author || user.name,
          category: body.category || 'Wellness',
          tags: body.tags || [],
          status: body.status || 'draft',
          seo: body.seo || {},
          createdAt: now, updatedAt: now,
        };
        await col.insertOne(doc);
        await logActivity(db, { actorId: user.id, action: 'blog:create', entityType: 'blog', entityId: doc.id, after: doc });
        return ok(clean(doc));
      }
      const bid = segs[2];
      if (bid && method === 'GET' && segs.length === 3) {
        const doc = await col.findOne({ id: bid });
        if (!doc) return err('not_found', 404);
        return ok(clean(doc));
      }
      if (bid && method === 'PATCH' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const before = await col.findOne({ id: bid });
        if (!before) return err('not_found', 404);
        const body = await req.json().catch(() => ({}));
        const { id: _id, ...rest } = body;
        await col.updateOne({ id: bid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
        const after = await col.findOne({ id: bid });
        return ok(clean(after));
      }
      if (bid && method === 'DELETE' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        await col.deleteOne({ id: bid });
        return ok({ ok: true });
      }
    }

    // Mini-blogs — short-form insights / social-tile posts surfaced on the homepage strip.
    if (segs[1] === 'mini-blog' || segs[1] === 'mini-blogs') {
      const col = db.collection('mini_blog');
      if (segs.length === 2 && method === 'GET') {
        const docs = await col.find({}).sort({ order: 1, createdAt: -1 }).limit(200).toArray();
        return ok(docs.map(clean));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.title) return err('title_required', 400);
        const now = new Date().toISOString();
        const doc = {
          id: randomUUID(),
          title: body.title,
          body: body.body || '',
          imageUrl: body.imageUrl || '',
          linkHref: body.linkHref || '',
          linkLabel: body.linkLabel || '',
          tag: body.tag || '',
          order: Number.isFinite(Number(body.order)) ? Number(body.order) : 0,
          status: body.status || 'draft',
          createdAt: now, updatedAt: now,
        };
        await col.insertOne(doc);
        await logActivity(db, { actorId: user.id, action: 'mini_blog:create', entityType: 'mini_blog', entityId: doc.id, after: doc });
        return ok(clean(doc));
      }
      const mid = segs[2];
      if (mid && segs.length === 3 && method === 'GET') {
        const doc = await col.findOne({ id: mid });
        if (!doc) return err('not_found', 404);
        return ok(clean(doc));
      }
      if (mid && segs.length === 3 && method === 'PATCH') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const before = await col.findOne({ id: mid });
        if (!before) return err('not_found', 404);
        const body = await req.json().catch(() => ({}));
        const { id: _id, ...rest } = body;
        if (rest.order !== undefined) rest.order = Number(rest.order) || 0;
        await col.updateOne({ id: mid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
        const after = await col.findOne({ id: mid });
        await logActivity(db, { actorId: user.id, action: 'mini_blog:update', entityType: 'mini_blog', entityId: mid, before, after });
        return ok(clean(after));
      }
      if (mid && segs.length === 3 && method === 'DELETE') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        await col.deleteOne({ id: mid });
        await logActivity(db, { actorId: user.id, action: 'mini_blog:delete', entityType: 'mini_blog', entityId: mid });
        return ok({ ok: true });
      }
    }
  }

  /* ---------- Notifications (templates + logs; send is stubbed) ---------- */
  if (segs[0] === 'notifications') {
    if (segs[1] === 'templates') {
      const col = db.collection('templates');
      if (segs.length === 2 && method === 'GET') {
        const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
        return ok(docs.map(clean));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.key || !body.channel) return err('key_channel_required', 400);
        const doc = {
          id: randomUUID(),
          key: body.key,
          channel: body.channel, // email | whatsapp | sms
          subject: body.subject || '',
          body: body.body || '',
          variables: body.variables || [],
          active: body.active !== false,
          createdAt: new Date().toISOString(),
        };
        await col.insertOne(doc);
        return ok(clean(doc));
      }
      const tid = segs[2];
      if (tid && method === 'PATCH' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        const { id: _id, ...rest } = body;
        await col.updateOne({ id: tid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
        const after = await col.findOne({ id: tid });
        return ok(clean(after));
      }
      if (tid && method === 'DELETE' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        await col.deleteOne({ id: tid });
        return ok({ ok: true });
      }
    }

    if (segs[1] === 'logs' && method === 'GET') {
      const docs = await db.collection('communications').find({}).sort({ sentAt: -1 }).limit(200).toArray();
      return ok(docs.map(clean));
    }

    if (segs[1] === 'send' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const channel = body.channel || 'email';
      let sendResult = null;
      let status = 'queued';
      let providerRef = null;
      let errorNote = null;

      if (channel === 'whatsapp' && body.to) {
        try {
          const { sendWhatsappTemplate } = await import('@/lib/whatsapp');
          sendResult = await sendWhatsappTemplate({
            to: body.to,
            templateKey: body.templateKey || body.templateId,
            templateName: body.templateName,
            languageCode: body.languageCode || 'en',
            variables: body.variables || body.payload || {},
            orderedVariables: body.orderedVariables,
          });
          if (sendResult.queued) {
            status = 'sent';
            providerRef = sendResult.messageId || null;
          } else {
            status = 'failed';
            errorNote = sendResult.error;
          }
        } catch (e) {
          status = 'failed';
          errorNote = String(e?.message || e);
        }
      }
      // Email/SMS providers not wired yet — record as queued.

      const doc = {
        id: randomUUID(),
        customerId: body.customerId || null,
        to: body.to || null,
        channel,
        templateId: body.templateId || body.templateKey || null,
        payload: body.payload || body.variables || {},
        status,
        providerRef,
        sentBy: user.id,
        sentAt: new Date().toISOString(),
        note: errorNote || (channel !== 'whatsapp' ? 'Provider not configured. Message queued in local log only.' : null),
      };
      await db.collection('communications').insertOne(doc);
      return ok(clean(doc));
    }
  }

  /* ---------- Settings ---------- */
  if (segs[0] === 'settings') {
    // Singleton settings — keys: 'business', 'brand', 'taxes'
    const col = db.collection('settings');
    if (segs.length === 1 && method === 'GET') {
      const docs = await col.find({}).toArray();
      const out = {};
      for (const d of docs) out[d.key] = d.value;
      return ok(out);
    }
    const key = segs[1];
    if (key && method === 'GET' && segs.length === 2) {
      const doc = await col.findOne({ key });
      return ok(doc ? doc.value : null);
    }
    if (key && method === 'PUT' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      await col.updateOne(
        { key },
        { $set: { key, value: body, updatedAt: now, updatedBy: user.id }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      await logActivity(db, { actorId: user.id, action: `settings:${key}:update`, entityType: 'settings', entityId: key, after: body });
      return ok({ ok: true, key, value: body });
    }
  }

  /* ---------- Resources (rooms / equipment) ---------- */
  if (segs[0] === 'resources') {
    const col = db.collection('resources');
    if (segs.length === 1 && method === 'GET') {
      const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
      return ok(docs.map(clean));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.type) return err('name_type_required', 400);
      const doc = {
        id: randomUUID(),
        name: body.name,
        type: body.type,
        capacity: Number(body.capacity) || 1,
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      return ok(clean(doc));
    }
    const rid = segs[1];
    if (rid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const { id: _id, ...rest } = body;
      await col.updateOne({ id: rid }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
      const after = await col.findOne({ id: rid });
      return ok(clean(after));
    }
    if (rid && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      await col.deleteOne({ id: rid });
      return ok({ ok: true });
    }
  }

  /* ---------- Integrations (API keys — masked read, super-admin write) ---------- */
  if (segs[0] === 'integrations') {
    if (segs.length === 1 && method === 'GET') {
      const docs = await db.collection('integrations').find({}).toArray();
      // Mask secrets on read
      const masked = docs.map((d) => {
        const value = { ...(d.config || {}) };
        for (const k of Object.keys(value)) {
          if (/secret|key|token|password/i.test(k) && typeof value[k] === 'string' && value[k]) {
            value[k] = '\u2022'.repeat(Math.max(6, value[k].length - 4)) + value[k].slice(-4);
          }
        }
        return { ...clean(d), config: value, configured: Object.values(d.config || {}).some(Boolean) };
      });
      return ok(masked);
    }
    if (segs.length === 2 && method === 'PUT') {
      if (user.role !== 'super_admin') return err('forbidden', 403);
      const key = segs[1];
      const body = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      await db.collection('integrations').updateOne(
        { key },
        { $set: { key, config: body, status: 'configured', updatedAt: now, updatedBy: user.id }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      await logActivity(db, { actorId: user.id, action: 'integration:update', entityType: 'integration', entityId: key });
      // Reset in-process caches so the new keys take effect immediately.
      try {
        if (key === 'razorpay') { const m = await import('@/lib/razorpay'); m._resetRazorpayCache?.(); }
        if (key === 'whatsapp') { const m = await import('@/lib/whatsapp'); m._resetWhatsappCache?.(); }
      } catch { /* noop */ }
      return ok({ ok: true, key });
    }
  }

  return err('not_found', 404);
}

function generateGiftCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `SW-${pick(4)}-${pick(4)}`;
}

async function nextInvoiceNumber(db) {
  const res = await db.collection('counters').findOneAndUpdate(
    { key: 'invoice' },
    { $inc: { seq: 1 }, $setOnInsert: { key: 'invoice', createdAt: new Date().toISOString() } },
    { upsert: true, returnDocument: 'after' }
  );
  // Handle both driver-shape variants
  const seq = res?.value?.seq ?? res?.seq ?? 1;
  return `INV-${String(seq).padStart(6, '0')}`;
}

function bucketByDay(from, days, docs, valueFn) {
  const buckets = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const value = docs
      .filter((x) => x.createdAt >= d.toISOString() && x.createdAt < next.toISOString())
      .reduce((s, x) => s + (valueFn(x) || 0), 0);
    buckets.push({ date: d.toISOString().slice(0, 10), value });
  }
  return buckets;
}

function guessResourceFromBooking(b) {
  const t = (b.therapy || '').toLowerCase();
  if (t.includes('float')) return 'float_1';
  if (t.includes('salt'))  return 'salt_1';
  if (t.includes('sauna')) return 'sauna_1';
  if (t.includes('plunge') || t.includes('cold')) return 'plunge_1';
  if (t.includes('red'))   return 'red_1';
  return 'other';
}

function slugify(s) {
  return (s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}