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

  return err('not_found', 404);
}
