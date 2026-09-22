// Salt World BOS — Admin API router.
// Mounted from /app/app/api/[[...path]]/route.js under /api/admin/*.
// Auth is enforced by /app/middleware.js (except /login /forgot /reset).

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { toCustomer, toTherapy, toBooking, toBookingFull, toSubscription, toGiftcard, toPage } from '@/lib/db-mappers';
import {
  signSession, setSessionCookie, clearSessionCookie, getCurrentUser,
} from '@/lib/auth';
import { ensureSeed, verifyPassword, hashPassword } from '@/lib/seed';
import { hasPermission, PERMISSIONS, ROLES } from '@/lib/permissions';

const ok  = (data, init = {}) => NextResponse.json(data, init);
const err = (message, status = 400, extra = {}) => NextResponse.json({ error: message, ...extra }, { status });

async function logActivity(supabase, { actorId, action, entityType, entityId, before, after }) {
  await supabase.from('activity_log').insert({
    id: randomUUID(), actor_id: actorId, action, created_at: new Date().toISOString(),
    data: { entityType, entityId, before: before ?? null, after: after ?? null },
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

// Generic per-row mapper for the many "id + a couple of columns + data jsonb"
// admin-content tables (leads-alike, marketing kinds, CMS, notifications
// templates/logs, etc.) — flattens `data` onto the top level and overlays
// the explicit columns actually queried.
function flat(row, cols = {}) {
  if (!row) return null;
  const { data, ...rest } = row;
  const mapped = { ...data };
  for (const [outKey, rowKey] of Object.entries(cols)) mapped[outKey] = rest[rowKey];
  return mapped;
}

const ilikeOr = (fields, q) => fields.map((f) => `${f}.ilike.%${q}%`).join(',');

/* ========================================================== */
/* Router                                                     */
/* ========================================================== */

export async function adminHandle(req, method, segs) {
  await ensureSeed();
  const supabase = getSupabase();

  // ---------- Auth (public sub-routes) ----------
  if (segs[0] === 'auth') {
    if (segs[1] === 'login' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');
      if (!email || !password) return err('email_password_required', 400);
      const { data: row } = await supabase.from('users').select('*').eq('email', email).eq('status', 'active').maybeSingle();
      if (!row) return err('invalid_credentials', 401);
      const okPass = await verifyPassword(password, row.password_hash);
      if (!okPass) return err('invalid_credentials', 401);
      const token = await signSession({ userId: row.id, role: row.role });
      await setSessionCookie(token);
      await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', row.id);
      const safe = { ...row.data, id: row.id, email: row.email, name: row.name, role: row.role, permissions: row.permissions, status: row.status, createdAt: row.created_at };
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
      const { data: row } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      // Do not leak whether email exists. Always return ok.
      if (row) {
        const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
        await supabase.from('password_resets').insert({
          id: randomUUID(), token, user_id: row.id, expires_at: expiresAt, used: false, created_at: new Date().toISOString(),
        });
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
      const { data: rec } = await supabase.from('password_resets').select('*').eq('token', token).eq('used', false).maybeSingle();
      if (!rec) return err('invalid_or_used_token', 400);
      if (new Date(rec.expires_at).getTime() < Date.now()) return err('token_expired', 400);
      const passwordHash = await hashPassword(password);
      await supabase.from('users').update({ password_hash: passwordHash, updated_at: new Date().toISOString() }).eq('id', rec.user_id);
      await supabase.from('password_resets').update({ used: true, used_at: new Date().toISOString() }).eq('id', rec.id);
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
      { data: bookingsTodayRows }, { data: bookingsWeekRows }, { count: customersCount },
      { count: leadsCount }, { count: giftcardsIssued }, { count: subsActive },
    ] = await Promise.all([
      supabase.from('bookings').select('*').gte('created_at', dayStart.toISOString()),
      supabase.from('bookings').select('*').gte('created_at', weekAgo.toISOString()),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()),
      supabase.from('giftcards').select('id', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()),
      supabase.from('member_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    const bookingsToday = (bookingsTodayRows || []).map(toBooking);
    const bookingsWeek = (bookingsWeekRows || []).map(toBooking);

    const todayRevenue = bookingsToday.reduce((s, b) => s + (b.total || 0), 0);

    // 7-day trend (revenue per day)
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const inRange = bookingsWeek.filter((b) => b.createdAt >= d.toISOString() && b.createdAt < next.toISOString());
      daily.push({ date: d.toISOString().slice(0, 10), revenue: inRange.reduce((s, b) => s + (b.total || 0), 0), bookings: inRange.length });
    }

    // Upcoming
    const { data: upcomingRows } = await supabase.from('bookings').select('*')
      .in('status', ['booked', 'confirmed', 'checked_in']).order('start_at', { ascending: true }).limit(8);

    return ok({
      kpis: {
        todayRevenue,
        bookingsToday: bookingsToday.length,
        walkIns: bookingsToday.filter((b) => b.source === 'walkin').length,
        pendingPayments: bookingsToday.filter((b) => b.payment === 'at-visit' || b.payment?.status === 'pending').length,
        giftcardsToday: giftcardsIssued || 0,
        membersActive: subsActive || 0,
        leadsToday: leadsCount || 0,
        customersTotal: customersCount || 0,
      },
      trend7d: daily,
      upcoming: (upcomingRows || []).map(toBooking),
    });
  }

  /* ---------- Customers ---------- */
  if (segs[0] === 'customers') {
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const q = url.searchParams.get('q');
      let query = supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(200);
      if (q) query = query.or(ilikeOr(['name', 'email', 'phone'], q));
      const { data: rows } = await query;
      return ok((rows || []).map(toCustomer));
    }

    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name) return err('name_required', 400);
      const now = new Date().toISOString();
      const id = randomUUID();
      const row = {
        id, name: body.name || '', email: (body.email || '').toLowerCase() || null, phone: body.phone || null,
        dob: body.dob || null, tags: body.tags || [], wallet_balance: 0,
        emergency_contact: body.emergencyContact || null, medical_notes: body.medicalNotes || '',
        preferred_therapist_id: body.preferredTherapistId || null, source: body.source || 'admin',
        status: 'active', lifetime_value: 0, last_visit_at: null, created_at: now, updated_at: now,
      };
      const { error } = await supabase.from('customers').insert(row);
      if (error) return err('insert_failed', 500);
      const doc = toCustomer(row);
      await logActivity(supabase, { actorId: user.id, action: 'customer:create', entityType: 'customer', entityId: id, after: doc });
      return ok(doc);
    }

    if (segs[1] === 'search' && method === 'GET') {
      const url = new URL(req.url);
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return ok([]);
      const { data: rows } = await supabase.from('customers').select('*').or(ilikeOr(['name', 'email', 'phone'], q)).limit(8);
      return ok((rows || []).map(toCustomer));
    }

    const id = segs[1];
    if (id && segs[2] === 'wallet-adjust' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const amountInr = Number(body.amountInr) || 0;
      const direction = body.direction === 'debit' ? 'debit' : 'credit';
      const note = body.note || '';
      if (amountInr <= 0) return err('amount_required', 400);
      if (!note.trim())   return err('reason_required', 400);
      const { postTransaction, LOYALTY_TYPES } = await import('@/lib/loyalty');
      const points = direction === 'debit' ? -amountInr : amountInr;
      try {
        const tx = await postTransaction({ customerId: id, type: LOYALTY_TYPES.MANUAL_ADJUSTMENT, points, amountInr, note: `[${direction}] ${note}`, ref: null, actorId: user.id });
        await logActivity(supabase, { actorId: user.id, action: `wallet:${direction}`, entityType: 'customer', entityId: id, after: tx });
        return ok(tx);
      } catch (e) { return err(e.message || 'wallet_adjust_failed', 400); }
    }
    if (id && segs[2] === 'wallet-history' && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_VIEW);
      if (permErr) return permErr;
      const { customerHistory, customerBalance } = await import('@/lib/loyalty');
      const [balance, history] = await Promise.all([customerBalance(id), customerHistory(id, 200)]);
      return ok({ balance, history });
    }

    if (id) {
      const permErrView = requirePermission(user, PERMISSIONS.CUSTOMERS_VIEW);
      if (permErrView) return permErrView;

      if (method === 'GET' && segs.length === 2) {
        const { data: row } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
        if (!row) return err('not_found', 404);
        const doc = toCustomer(row);
        const [{ data: invoiceRows }, { data: giftcardRows }, { data: subRows }, { data: commRows }, { data: noteRows }] = await Promise.all([
          supabase.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
          doc.email ? supabase.from('giftcards').select('*').contains('data', { to: { email: doc.email } }).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
          supabase.from('member_subscriptions').select('*').eq('customer_id', id).order('starts_at', { ascending: false }),
          supabase.from('communications').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('notes').select('*').eq('parent_type', 'customer').eq('parent_id', id).order('created_at', { ascending: false }),
        ]);
        return ok({
          customer: doc,
          visits: [],
          invoices: (invoiceRows || []).map((r) => ({ ...r.data, id: r.id, number: r.number, customerId: r.customer_id, customerName: r.customer_name, amount: r.amount, status: r.status, createdAt: r.created_at })),
          giftcards: (giftcardRows || []).map(toGiftcard),
          subscriptions: (subRows || []).map(toSubscription),
          communications: (commRows || []).map((r) => ({ ...r.data, id: r.id, customerId: r.customer_id, channel: r.channel, status: r.status, createdAt: r.created_at })),
          notes: (noteRows || []).map((r) => ({ ...r.data, id: r.id, parentType: r.parent_type, parentId: r.parent_id, authorId: r.author_id, body: r.body, createdAt: r.created_at })),
        });
      }

      if (method === 'PATCH' && segs.length === 2) {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        const { data: beforeRow } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        const before = toCustomer(beforeRow);
        const patch = { updated_at: new Date().toISOString() };
        const colMap = { name: 'name', email: 'email', phone: 'phone', dob: 'dob', tags: 'tags', emergencyContact: 'emergency_contact', preferredTherapistId: 'preferred_therapist_id' };
        for (const [k, col] of Object.entries(colMap)) if (k in body) patch[col] = body[k];
        if ('medicalNotes' in body) {
          const permMed = requirePermission(user, PERMISSIONS.CUSTOMERS_MEDICAL);
          if (permMed) return permMed;
          patch.medical_notes = body.medicalNotes;
        }
        await supabase.from('customers').update(patch).eq('id', id);
        const { data: afterRow } = await supabase.from('customers').select('*').eq('id', id).single();
        const after = toCustomer(afterRow);
        await logActivity(supabase, { actorId: user.id, action: 'customer:update', entityType: 'customer', entityId: id, before, after });
        return ok(after);
      }

      if (method === 'DELETE' && segs.length === 2) {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const { data: beforeRow } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        await supabase.from('customers').delete().eq('id', id);
        await logActivity(supabase, { actorId: user.id, action: 'customer:delete', entityType: 'customer', entityId: id, before: toCustomer(beforeRow) });
        return ok({ ok: true });
      }

      if (segs[2] === 'notes' && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.body) return err('body_required', 400);
        const noteId = randomUUID();
        const createdAt = new Date().toISOString();
        await supabase.from('notes').insert({
          id: noteId, parent_type: 'customer', parent_id: id, author_id: user.id, body: body.body, created_at: createdAt,
          data: { authorName: user.name },
        });
        return ok({ id: noteId, parentType: 'customer', parentId: id, authorId: user.id, authorName: user.name, body: body.body, createdAt });
      }

      // Disable / enable customer access — blocks OTP verification when disabled.
      if ((segs[2] === 'disable' || segs[2] === 'enable') && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
        if (permErr) return permErr;
        const { data: beforeRow } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        const disabled = segs[2] === 'disable';
        const now = new Date().toISOString();
        await supabase.from('customers').update({
          updated_at: now, data: { ...beforeRow.data, disabled, disabledAt: disabled ? now : null },
        }).eq('id', id);
        const { data: afterRow } = await supabase.from('customers').select('*').eq('id', id).single();
        const after = toCustomer(afterRow);
        await logActivity(supabase, { actorId: user.id, action: disabled ? 'customer:disable' : 'customer:enable', entityType: 'customer', entityId: id, before: toCustomer(beforeRow), after });
        return ok(after);
      }
    }
  }

  /* ---------- Bookings ---------- */
  if (segs[0] === 'bookings') {
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_VIEW);
      if (permErr) return permErr;
      const { expireStalePendingBookings } = await import('@/lib/booking-rules');
      await expireStalePendingBookings().catch(() => {});
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const q      = url.searchParams.get('q');
      const from   = url.searchParams.get('from');
      const to     = url.searchParams.get('to');
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(500);
      if (status) query = query.eq('status', status);
      if (q) query = query.or(ilikeOr(['ref', 'contact_name', 'contact_phone'], q));
      if (from) query = query.gte('start_at', from);
      if (to) query = query.lte('start_at', to);
      const { data: rows } = await query;
      return ok((rows || []).map(toBooking));
    }

    if (segs[1] === 'calendar' && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_CALENDAR);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const from = url.searchParams.get('from');
      const to   = url.searchParams.get('to');
      let query = supabase.from('bookings').select('*, booking_schedule_items(*)').limit(400);
      if (from) query = query.gte('start_at', from);
      if (to) query = query.lte('start_at', to);
      const { data: rows } = await query;
      return ok((rows || []).map((r) => {
        const b = toBooking(r);
        b.schedule = (r.booking_schedule_items || []).sort((a, b2) => (a.position || 0) - (b2.position || 0))
          .map((s) => ({ therapySlug: s.therapy_slug, resourceId: s.resource_id, resourceName: s.resource_id, from: s.starts_at, to: s.ends_at }));
        return b;
      }));
    }

    const id = segs[1];
    if (id && method === 'GET' && segs.length === 2) {
      let { data: row } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
      if (!row) ({ data: row } = await supabase.from('bookings').select('*').eq('ref', id).maybeSingle());
      if (!row) return err('not_found', 404);
      return ok(await toBookingFull(supabase, row));
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
      const { data: beforeRow } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const now = new Date().toISOString();
      const patch = { status: nextStatus, updated_at: now, data: { ...beforeRow.data } };
      if (segs[2] === 'check-in')  patch.data.checkedInAt  = now;
      if (segs[2] === 'start')     patch.data.startedAt    = now;
      if (segs[2] === 'complete')  patch.data.completedAt  = now;
      await supabase.from('bookings').update(patch).eq('id', id);
      const { data: afterRow } = await supabase.from('bookings').select('*').eq('id', id).single();
      const before = await toBookingFull(supabase, beforeRow);
      const after = await toBookingFull(supabase, afterRow);
      await logActivity(supabase, { actorId: user.id, action: `booking:${segs[2]}`, entityType: 'booking', entityId: id, before, after });
      return ok(after);
    }
  }

  /* ---------- Universal search ---------- */
  if (segs[0] === 'search' && method === 'GET') {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return ok({ customers: [], bookings: [], pages: [] });
    const [{ data: customers }, { data: bookings }, { data: pages }] = await Promise.all([
      supabase.from('customers').select('*').or(ilikeOr(['name', 'email', 'phone'], q)).limit(6),
      supabase.from('bookings').select('*').or(ilikeOr(['ref', 'contact_name', 'contact_phone'], q)).limit(6),
      supabase.from('pages').select('*').or(`slug.ilike.%${q}%`).limit(6),
    ]);
    return ok({
      customers: (customers || []).map(toCustomer),
      bookings:  (bookings || []).map(toBooking),
      pages:     (pages || []).map(toPage),
    });
  }

  /* ---------- Activity log ---------- */
  if (segs[0] === 'activity' && method === 'GET') {
    const permErr = requirePermission(user, PERMISSIONS.ACTIVITY_VIEW);
    if (permErr) return permErr;
    const { data: rows } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100);
    return ok((rows || []).map((r) => ({ ...r.data, id: r.id, actorId: r.actor_id, action: r.action, createdAt: r.created_at })));
  }

  /* ---------- Referrals + Loyalty ---------- */
  if (segs[0] === 'referrals') {
    const { referralStats, topReferrers } = await import('@/lib/loyalty');
    if (segs[1] === 'stats' && method === 'GET') {
      const [{ count: total }, { count: totalCust }, { data: refRows }] = await Promise.all([
        supabase.from('referrals').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('referrals').select('total_inr, referrer_reward'),
      ]);
      const revenue = (refRows || []).reduce((s, r) => s + Number(r.total_inr || 0), 0);
      const rewards = (refRows || []).reduce((s, r) => s + Number(r.referrer_reward || 0), 0);
      const top = await topReferrers({ limit: 15 });
      return ok({
        totalReferrals: total || 0, totalRevenue: revenue, totalRewards: rewards,
        conversionRate: totalCust > 0 ? (total || 0) / totalCust : 0,
        topReferrers: top,
      });
    }
    if (segs[1] === 'customer' && segs[2] && method === 'GET') {
      return ok(await referralStats(segs[2]));
    }
  }

  if (segs[0] === 'wallet') {
    const { customerBalance, customerHistory, postTransaction, LOYALTY_TYPES } = await import('@/lib/loyalty');
    if (segs[1] && segs[2] === 'balance' && method === 'GET') {
      const bal = await customerBalance(segs[1]);
      return ok({ balance: bal });
    }
    if (segs[1] && segs[2] === 'history' && method === 'GET') {
      return ok(await customerHistory(segs[1], 100));
    }
    if (segs[1] && segs[2] === 'adjust' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.CUSTOMERS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const points = Number(body.points);
      if (!Number.isFinite(points) || points === 0) return err('invalid_points', 400);
      const tx = await postTransaction({ customerId: segs[1], type: LOYALTY_TYPES.MANUAL_ADJUSTMENT, points, note: body.note || 'Manual adjustment', actorId: user.id });
      await logActivity(supabase, { actorId: user.id, action: 'wallet:adjust', entityType: 'wallet', entityId: segs[1], after: tx });
      return ok(tx);
    }
  }

  /* ---------- Outcome → Therapy mapping (admin-editable) ---------- */
  if (segs[0] === 'outcome-mapping') {
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('outcome_therapy_map').select('*').order('outcome_slug', { ascending: true });
      return ok((rows || []).map((r) => ({ ...r.data, outcomeSlug: r.outcome_slug, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at })));
    }
    if (segs.length === 2 && method === 'GET') {
      const { data: row } = await supabase.from('outcome_therapy_map').select('*').eq('outcome_slug', segs[1]).maybeSingle();
      if (!row) return err('not_found', 404);
      return ok({ ...row.data, outcomeSlug: row.outcome_slug, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at });
    }
    if (segs.length === 2 && method === 'PUT') {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const outcomeSlug = segs[1];
      const now = new Date().toISOString();
      const therapies = Array.isArray(body.therapies) ? body.therapies : [];
      const cleanedTherapies = therapies.map((t, i) => ({
        slug: t.slug, label: t.label || t.slug, role: t.role || 'Adjunct', description: t.description || '',
        durationMin: t.durationMin ? Number(t.durationMin) : null,
        displayOrder: t.displayOrder != null ? Number(t.displayOrder) : i,
      })).sort((a, b) => a.displayOrder - b.displayOrder);
      const active = body.active !== false;
      const doc = {
        outcomeSlug, therapies: cleanedTherapies,
        defaultSelected: Array.isArray(body.defaultSelected) ? body.defaultSelected : [],
        branchIds: Array.isArray(body.branchIds) ? body.branchIds : [],
        active, updatedAt: now, updatedBy: user.id,
      };
      const { data: existing } = await supabase.from('outcome_therapy_map').select('id, created_at').eq('outcome_slug', outcomeSlug).maybeSingle();
      await supabase.from('outcome_therapy_map').upsert({
        id: existing?.id || randomUUID(), outcome_slug: outcomeSlug, active, created_at: existing?.created_at || now, updated_at: now,
        data: { therapies: cleanedTherapies, defaultSelected: doc.defaultSelected, branchIds: doc.branchIds, updatedBy: user.id },
      }, { onConflict: 'outcome_slug' });
      await logActivity(supabase, { actorId: user.id, action: 'outcome_map:update', entityType: 'outcome_map', entityId: outcomeSlug, after: doc });
      return ok(doc);
    }
    if (segs.length === 2 && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      await supabase.from('outcome_therapy_map').delete().eq('outcome_slug', segs[1]);
      return ok({ ok: true });
    }
  }

  /* ---------- Branches (multi-branch foundation) ---------- */
  if (segs[0] === 'branches') {
    const toBranchDoc = (row) => ({ ...row.data, id: row.id, code: row.code, name: row.name, isDefault: row.is_default, hours: row.hours, createdAt: row.created_at, updatedAt: row.updated_at });

    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('branches').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: true });
      return ok((rows || []).map(toBranchDoc));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.BRANCHES_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.code) return err('name_code_required', 400);
      const code = String(body.code).toUpperCase().trim();
      const { data: dup } = await supabase.from('branches').select('id').eq('code', code).maybeSingle();
      if (dup) return err('code_taken', 409);
      const { count } = await supabase.from('branches').select('id', { count: 'exact', head: true });
      const isFirst = !count;
      const now = new Date().toISOString();
      const id = randomUUID();
      const row = {
        id, code, name: body.name, is_default: isFirst, hours: body.hours || {}, created_at: now, updated_at: now,
        data: { address: body.address || '', phone: body.phone || '', whatsapp: body.whatsapp || '', email: body.email || '', timezone: body.timezone || 'Asia/Kolkata', currency: body.currency || 'INR', status: body.status || 'active', holidays: body.holidays || [] },
      };
      await supabase.from('branches').insert(row);
      const doc = toBranchDoc(row);
      await logActivity(supabase, { actorId: user.id, action: 'branch:create', entityType: 'branch', entityId: id, after: doc });
      return ok(doc);
    }

    const bid = segs[1];
    if (bid && segs.length === 2 && method === 'GET') {
      const { data: row } = await supabase.from('branches').select('*').eq('id', bid).maybeSingle();
      if (!row) return err('not_found', 404);
      return ok(toBranchDoc(row));
    }
    if (bid && segs.length === 2 && method === 'PATCH') {
      const permErr = requirePermission(user, PERMISSIONS.BRANCHES_EDIT);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from('branches').select('*').eq('id', bid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, isDefault: _def, code: newCode, name, hours, ...restExtra } = body;
      const patch = { updated_at: new Date().toISOString() };
      if (name) patch.name = name;
      if (hours) patch.hours = hours;
      if (newCode) {
        const c = String(newCode).toUpperCase().trim();
        if (c !== beforeRow.code) {
          const { data: dup } = await supabase.from('branches').select('id').eq('code', c).neq('id', bid).maybeSingle();
          if (dup) return err('code_taken', 409);
          patch.code = c;
        }
      }
      if (Object.keys(restExtra).length) patch.data = { ...beforeRow.data, ...restExtra };
      await supabase.from('branches').update(patch).eq('id', bid);
      const { data: afterRow } = await supabase.from('branches').select('*').eq('id', bid).single();
      await logActivity(supabase, { actorId: user.id, action: 'branch:update', entityType: 'branch', entityId: bid, before: toBranchDoc(beforeRow), after: toBranchDoc(afterRow) });
      return ok(toBranchDoc(afterRow));
    }
    if (bid && segs.length === 2 && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.BRANCHES_EDIT);
      if (permErr) return permErr;
      const { data: row } = await supabase.from('branches').select('*').eq('id', bid).maybeSingle();
      if (!row) return err('not_found', 404);
      if (row.is_default) return err('cannot_delete_default', 400);
      await supabase.from('branches').delete().eq('id', bid);
      await logActivity(supabase, { actorId: user.id, action: 'branch:delete', entityType: 'branch', entityId: bid, before: toBranchDoc(row) });
      return ok({ ok: true });
    }
    // POST /branches/:id/default → promote to default
    if (bid && segs[2] === 'default' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.BRANCHES_EDIT);
      if (permErr) return permErr;
      const { data: row } = await supabase.from('branches').select('id').eq('id', bid).maybeSingle();
      if (!row) return err('not_found', 404);
      await supabase.from('branches').update({ is_default: false }).neq('id', bid);
      await supabase.from('branches').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', bid);
      await logActivity(supabase, { actorId: user.id, action: 'branch:set_default', entityType: 'branch', entityId: bid });
      return ok({ ok: true });
    }
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
            const sb2 = getSupabase();
            const now = new Date(); now.setHours(0,0,0,0);
            const { count: bookingsToday } = await sb2.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', now.toISOString());
            send({ type: 'tick', at: new Date().toISOString(), bookingsToday: bookingsToday || 0 });
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
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      return ok((rows || []).map((r) => ({ ...r.data, id: r.id, email: r.email, name: r.name, role: r.role, permissions: r.permissions, status: r.status, branchId: r.branch_id, lastLoginAt: r.last_login_at, createdAt: r.created_at })));
    }
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (!body.email || !body.name || !body.password) return err('missing_fields', 400);
      const { data: exists } = await supabase.from('users').select('id').eq('email', body.email.toLowerCase()).maybeSingle();
      if (exists) return err('email_exists', 400);
      const id = randomUUID();
      const row = {
        id, email: body.email.toLowerCase(), name: body.name, role: body.role || 'reception',
        permissions: body.permissions || [], password_hash: await hashPassword(body.password),
        status: 'active', created_at: new Date().toISOString(),
      };
      await supabase.from('users').insert(row);
      return ok({ id, email: row.email, name: row.name, role: row.role, permissions: row.permissions, status: row.status, createdAt: row.created_at });
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
    const kinds = ['therapies', 'journeys', 'packages'];
    if (!kinds.includes(sub)) return err('unknown_service_kind', 404);

    if (segs.length === 2 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_VIEW);
      if (permErr) return permErr;
      if (sub === 'therapies') {
        const { data: rows } = await supabase.from('therapies').select('*, therapy_resources(resource_id)').order('created_at', { ascending: false });
        return ok((rows || []).map((r) => ({ ...toTherapy(r), resourceIds: (r.therapy_resources || []).map((tr) => tr.resource_id) })));
      }
      const { data: rows } = await supabase.from(sub).select('*').order('created_at', { ascending: false });
      return ok((rows || []).map((r) => ({ ...r.data, id: r.id, slug: r.slug, name: r.name, active: r.active, defaultPrice: r.default_price, createdAt: r.created_at, updatedAt: r.updated_at })));
    }
    if (segs.length === 2 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name) return err('name_required', 400);
      const now = new Date().toISOString();
      const id = randomUUID();
      const slug = body.slug || slugify(body.name);
      if (sub === 'therapies') {
        const row = {
          id, slug, name: body.name, is_system: false, active: body.active !== false,
          online_booking_enabled: body.onlineBookingEnabled !== false,
          duration_min: Number(body.durationMin) || 60, pre_buffer_min: Number(body.preBufferMin) || 0,
          post_buffer_min: Number(body.postBufferMin) || 0, cleaning_buffer_min: Number(body.cleaningBufferMin) || 15,
          max_capacity: Number(body.maxCapacity) || 1, default_price: Number(body.defaultPrice) || 0,
          tax_hsn: body.taxHsn || '999722', description: body.description || '', hero_image: body.heroImage || '',
          images: Array.isArray(body.images) ? body.images : [], branch_ids: Array.isArray(body.branchIds) ? body.branchIds : [],
          seo: body.seo || null, created_at: now, updated_at: now,
        };
        const { error } = await supabase.from('therapies').insert(row);
        if (error) return err(error.message, 400);
        const resourceIds = Array.isArray(body.resourceIds) ? body.resourceIds : [];
        for (const rid of resourceIds) await supabase.from('therapy_resources').insert({ therapy_id: id, resource_id: rid });
        const doc = { ...toTherapy(row), resourceIds };
        await logActivity(supabase, { actorId: user.id, action: `${sub}:create`, entityType: sub, entityId: id, after: doc });
        return ok(doc);
      }
      const { name, ...restBody } = body;
      const row = { id, slug, name: body.name, active: body.active !== false, default_price: Number(body.defaultPrice) || 0, created_at: now, updated_at: now, data: restBody };
      await supabase.from(sub).insert(row);
      const doc = { ...restBody, id, slug, name: body.name, active: row.active, defaultPrice: row.default_price, createdAt: now, updatedAt: now };
      await logActivity(supabase, { actorId: user.id, action: `${sub}:create`, entityType: sub, entityId: id, after: doc });
      return ok(doc);
    }
    const sid = segs[2];
    if (sid && method === 'GET' && segs.length === 3) {
      if (sub === 'therapies') {
        const { data: row } = await supabase.from('therapies').select('*, therapy_resources(resource_id)').eq('id', sid).maybeSingle();
        if (!row) return err('not_found', 404);
        return ok({ ...toTherapy(row), resourceIds: (row.therapy_resources || []).map((tr) => tr.resource_id) });
      }
      const { data: row } = await supabase.from(sub).select('*').eq('id', sid).maybeSingle();
      if (!row) return err('not_found', 404);
      return ok({ ...row.data, id: row.id, slug: row.slug, name: row.name, active: row.active, defaultPrice: row.default_price, createdAt: row.created_at, updatedAt: row.updated_at });
    }
    if (sid && method === 'PATCH' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const { id: _id, resourceIds, ...rest } = body;
      const now = new Date().toISOString();
      if (sub === 'therapies') {
        const { data: beforeRow } = await supabase.from('therapies').select('*, therapy_resources(resource_id)').eq('id', sid).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        const before = { ...toTherapy(beforeRow), resourceIds: (beforeRow.therapy_resources || []).map((tr) => tr.resource_id) };
        const colMap = {
          name: 'name', slug: 'slug', active: 'active', onlineBookingEnabled: 'online_booking_enabled', durationMin: 'duration_min',
          preBufferMin: 'pre_buffer_min', postBufferMin: 'post_buffer_min', cleaningBufferMin: 'cleaning_buffer_min',
          maxCapacity: 'max_capacity', defaultPrice: 'default_price', taxHsn: 'tax_hsn', description: 'description',
          heroImage: 'hero_image', images: 'images', branchIds: 'branch_ids', seo: 'seo', concurrentResources: 'concurrent_resources',
          durationOptions: 'duration_options',
        };
        const patch = { updated_at: now };
        const extra = {};
        for (const [k, v] of Object.entries(rest)) { if (colMap[k]) patch[colMap[k]] = v; else extra[k] = v; }
        if (Object.keys(extra).length) patch.data = { ...beforeRow.data, ...extra };
        await supabase.from('therapies').update(patch).eq('id', sid);
        if (Array.isArray(resourceIds)) {
          await supabase.from('therapy_resources').delete().eq('therapy_id', sid);
          for (const rid of resourceIds) await supabase.from('therapy_resources').insert({ therapy_id: sid, resource_id: rid });
        }
        const { data: afterRow } = await supabase.from('therapies').select('*, therapy_resources(resource_id)').eq('id', sid).single();
        const after = { ...toTherapy(afterRow), resourceIds: (afterRow.therapy_resources || []).map((tr) => tr.resource_id) };
        await logActivity(supabase, { actorId: user.id, action: `${sub}:update`, entityType: sub, entityId: sid, before, after });
        return ok(after);
      }
      const { data: beforeRow } = await supabase.from(sub).select('*').eq('id', sid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const { name, slug, active, defaultPrice, ...extra } = rest;
      const patch = { updated_at: now, data: { ...beforeRow.data, ...extra } };
      if (name !== undefined) patch.name = name;
      if (slug !== undefined) patch.slug = slug;
      if (active !== undefined) patch.active = active;
      if (defaultPrice !== undefined) patch.default_price = Number(defaultPrice) || 0;
      await supabase.from(sub).update(patch).eq('id', sid);
      const { data: afterRow } = await supabase.from(sub).select('*').eq('id', sid).single();
      const after = { ...afterRow.data, id: afterRow.id, slug: afterRow.slug, name: afterRow.name, active: afterRow.active, defaultPrice: afterRow.default_price, createdAt: afterRow.created_at, updatedAt: afterRow.updated_at };
      await logActivity(supabase, { actorId: user.id, action: `${sub}:update`, entityType: sub, entityId: sid, before: { ...beforeRow.data, id: beforeRow.id }, after });
      return ok(after);
    }
    if (sid && method === 'DELETE' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.SERVICES_EDIT);
      if (permErr) return permErr;
      const { data: before } = await supabase.from(sub).select('*').eq('id', sid).maybeSingle();
      if (!before) return err('not_found', 404);
      if (sub === 'therapies' && before.is_system) return err('system_therapy_cannot_be_deleted', 400);
      await supabase.from(sub).delete().eq('id', sid);
      await logActivity(supabase, { actorId: user.id, action: `${sub}:delete`, entityType: sub, entityId: sid, before });
      return ok({ ok: true });
    }
  }

  /* ---------- Memberships (plans + subscriptions) ---------- */
  if (segs[0] === 'memberships') {
    if (segs[1] === 'subs') {
      if (segs.length === 2 && method === 'GET') {
        const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_VIEW);
        if (permErr) return permErr;
        const { data: rows } = await supabase.from('member_subscriptions').select('*').order('starts_at', { ascending: false }).limit(400);
        return ok((rows || []).map(toSubscription));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.customerId || !body.membershipId) return err('customer_and_plan_required', 400);
        try {
          const { grantSubscription } = await import('@/lib/memberships');
          const doc = await grantSubscription({ customerId: body.customerId, planId: body.membershipId, payment: { method: body.paymentMethod || 'offline', ref: body.paymentRef || null }, actorId: user.id });
          await logActivity(supabase, { actorId: user.id, action: 'membership_sub:create', entityType: 'memberSubscription', entityId: doc.id, after: doc });
          return ok(doc);
        } catch (e) { return err(e.message || 'grant_failed', 400); }
      }
      const sid = segs[2];
      if (sid && segs[3] === 'usage' && method === 'GET') {
        const { data: rows } = await supabase.from('membership_usage').select('*').eq('subscription_id', sid).order('consumed_at', { ascending: false }).limit(200);
        return ok((rows || []).map((r) => ({ ...r.data, id: r.id, subscriptionId: r.subscription_id, bookingId: r.booking_id, therapySlug: r.therapy_slug, consumedAt: r.consumed_at })));
      }
      if (sid && segs[3] === 'ledger' && method === 'GET') {
        const { data: rows } = await supabase.from('membership_transactions').select('*').eq('subscription_id', sid).order('created_at', { ascending: false }).limit(200);
        return ok((rows || []).map((r) => ({ ...r.data, id: r.id, subscriptionId: r.subscription_id, type: r.type, note: r.note, amount: r.amount, actorId: r.actor_id, createdAt: r.created_at })));
      }
      if (sid && segs[3] && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        try {
          const m = await import('@/lib/memberships');
          let after;
          if (segs[3] === 'freeze')   after = await m.freezeSubscription({ subscriptionId: sid, actorId: user.id, reason: body.reason });
          else if (segs[3] === 'unfreeze') after = await m.unfreezeSubscription({ subscriptionId: sid, actorId: user.id });
          else if (segs[3] === 'extend')   after = await m.extendSubscription({ subscriptionId: sid, days: Number(body.days) || 30, actorId: user.id, note: body.note });
          else if (segs[3] === 'adjust')   after = await m.adjustSubscription({ subscriptionId: sid, sessionsDelta: Number(body.sessionsDelta) || 0, walletDelta: Number(body.walletDelta) || 0, actorId: user.id, note: body.note });
          else if (segs[3] === 'cancel')   after = await m.cancelSubscription({ subscriptionId: sid, actorId: user.id, reason: body.reason });
          else if (segs[3] === 'mark-paid') after = await m.markSubscriptionPaid({ subscriptionId: sid, actorId: user.id, paymentRef: body.paymentRef, method: body.method || 'offline' });
          else return err('unknown_action', 400);
          await logActivity(supabase, { actorId: user.id, action: `membership_sub:${segs[3]}`, entityType: 'memberSubscription', entityId: sid, after });
          return ok(after);
        } catch (e) {
          if (e.code === 'cannot_cancel_paid_subscription') return err(e.code, 403, { message: e.message });
          return err(e.message || 'action_failed', 400);
        }
      }
    }

    // Plans
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_VIEW);
      if (permErr) return permErr;
      const { data: rows } = await supabase.from('memberships').select('*').order('created_at', { ascending: false });
      const docs = (rows || []).map((r) => ({ ...r.plan, id: r.id, slug: r.slug, name: r.name, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at }))
        .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      return ok(docs);
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.price) return err('name_price_required', 400);
      const { normalizePlan } = await import('@/lib/memberships');
      const plan = normalizePlan({ ...body, id: randomUUID(), createdAt: new Date().toISOString() });
      const { name, slug, active, createdAt, updatedAt, id, ...planRest } = plan;
      await supabase.from('memberships').insert({ id, slug, name, active, plan: planRest, created_at: createdAt, updated_at: updatedAt });
      await logActivity(supabase, { actorId: user.id, action: 'membership:create', entityType: 'membership', entityId: id, after: plan });
      return ok(plan);
    }
    const mid = segs[1];
    if (mid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from('memberships').select('*').eq('id', mid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const before = { ...beforeRow.plan, id: beforeRow.id, slug: beforeRow.slug, name: beforeRow.name, active: beforeRow.active };
      const body = await req.json().catch(() => ({}));
      const { id: _id, ...rest } = body;
      const { normalizePlan } = await import('@/lib/memberships');
      const merged = normalizePlan({ ...before, ...rest, id: mid });
      const { name, slug, active, createdAt, updatedAt, id, ...planRest } = merged;
      await supabase.from('memberships').update({ name, slug, active, plan: planRest, updated_at: updatedAt }).eq('id', mid);
      await logActivity(supabase, { actorId: user.id, action: 'membership:update', entityType: 'membership', entityId: mid, before, after: merged });
      return ok(merged);
    }
    if (mid && method === 'DELETE' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.MEMBERSHIPS_EDIT);
      if (permErr) return permErr;
      const { data: before } = await supabase.from('memberships').select('*').eq('id', mid).maybeSingle();
      if (!before) return err('not_found', 404);
      await supabase.from('memberships').delete().eq('id', mid);
      await logActivity(supabase, { actorId: user.id, action: 'membership:delete', entityType: 'membership', entityId: mid, before });
      return ok({ ok: true });
    }
  }

  /* ---------- Coupons (Influencer / Marketing) ---------- */
  if (segs[0] === 'coupons') {
    const { createCoupon, updateCoupon, deleteCoupon, listCoupons, getById, reportCoupons, listRedemptions } = await import('@/lib/coupons');

    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      return ok(await listCoupons());
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.code)          return err('code_required', 400);
      if (!body.discountValue) return err('discount_value_required', 400);
      try {
        const doc = await createCoupon({ ...body, createdBy: user.id });
        await logActivity(supabase, { actorId: user.id, action: 'coupon:create', entityType: 'coupon', entityId: doc.id, after: doc });
        return ok(doc);
      } catch (e) { return err(e.message || 'create_failed', 400); }
    }
    if (segs[1] === 'report' && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const url = new URL(req.url);
      return ok(await reportCoupons({ from: url.searchParams.get('from'), to: url.searchParams.get('to') }));
    }
    const cid = segs[1];
    if (cid && segs[2] === 'redemptions' && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      return ok(await listRedemptions({ couponId: cid }));
    }
    if (cid && method === 'GET' && segs.length === 2) {
      const doc = await getById(cid);
      if (!doc) return err('not_found', 404);
      return ok(doc);
    }
    if (cid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      try {
        const before = await getById(cid);
        const after  = await updateCoupon(cid, body);
        await logActivity(supabase, { actorId: user.id, action: 'coupon:update', entityType: 'coupon', entityId: cid, before, after });
        return ok(after);
      } catch (e) { return err(e.message || 'update_failed', 400); }
    }
    if (cid && method === 'DELETE' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const before = await getById(cid);
      if (!before) return err('not_found', 404);
      await deleteCoupon(cid);
      await logActivity(supabase, { actorId: user.id, action: 'coupon:delete', entityType: 'coupon', entityId: cid, before });
      return ok({ ok: true });
    }
  }

  /* ---------- Gift Cards ---------- */
  if (segs[0] === 'giftcards') {
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      let query = supabase.from('giftcards').select('*').order('created_at', { ascending: false }).limit(400);
      if (status) query = query.eq('status', status);
      const { data: rows } = await query;
      return ok((rows || []).map(toGiftcard));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_ISSUE);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const amount = Number(body.amount);
      if (!amount || amount < 100) return err('amount_required', 400);
      const code = generateGiftCode();
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      const id = randomUUID();
      const expiresAt = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString(); })();
      const now = new Date().toISOString();
      const row = {
        id, code, pin, balance: amount, status: 'active', claimed_by_customer_id: null, claimed_at: null,
        expires_at: expiresAt, created_at: now, updated_at: now,
        data: {
          designId: body.designId || 'halite', amount, from: body.from || { name: '', email: '' }, to: body.to || { name: '', email: '', phone: '' },
          message: body.message || '', deliverAt: body.deliverAt || null, deliveryStatus: 'pending', issuedBy: user.id,
          corporateOrderId: body.corporateOrderId || null, applicableTherapies: Array.isArray(body.applicableTherapies) ? body.applicableTherapies : [],
          applicableBranches: Array.isArray(body.applicableBranches) ? body.applicableBranches : [],
        },
      };
      await supabase.from('giftcards').insert(row);
      const doc = toGiftcard(row);
      await logActivity(supabase, { actorId: user.id, action: 'giftcard:issue', entityType: 'giftcard', entityId: id, after: doc });
      return ok(doc);
    }

    if (segs[1] === 'by-code' && segs[2] && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_VIEW);
      if (permErr) return permErr;
      const { data: row } = await supabase.from('giftcards').select('*').eq('code', String(segs[2]).toUpperCase()).maybeSingle();
      if (!row) return err('not_found', 404);
      return ok(toGiftcard(row));
    }

    const gid = segs[1];
    if (gid && method === 'GET' && segs.length === 2) {
      const { data: row } = await supabase.from('giftcards').select('*').eq('id', gid).maybeSingle();
      if (!row) return err('not_found', 404);
      return ok(toGiftcard(row));
    }
    if (gid && segs[2] === 'redeem' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.GIFTCARDS_REDEEM);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from('giftcards').select('*').eq('id', gid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const before = toGiftcard(beforeRow);
      const body = await req.json().catch(() => ({}));
      const amt = Math.min(Number(body.amount) || before.balance, before.balance);
      if (amt <= 0) return err('nothing_to_redeem', 400);
      const newBalance = before.balance - amt;
      await supabase.from('giftcards').update({
        balance: newBalance, status: newBalance === 0 ? 'redeemed' : 'active', updated_at: new Date().toISOString(),
      }).eq('id', gid);
      const { data: afterRow } = await supabase.from('giftcards').select('*').eq('id', gid).single();
      const after = toGiftcard(afterRow);
      await logActivity(supabase, { actorId: user.id, action: 'giftcard:redeem', entityType: 'giftcard', entityId: gid, before, after });
      return ok(after);
    }
  }

  /* ---------- Products & Inventory ---------- */
  if (segs[0] === 'product-categories') {
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('product_categories').select('*').order('created_at', { ascending: true });
      return ok((rows || []).map((r) => ({ ...r.data, id: r.id, name: r.name, active: r.active, createdAt: r.created_at })));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name) return err('name_required', 400);
      const id = randomUUID();
      const row = { id, name: body.name, active: true, created_at: new Date().toISOString(), data: { sort: Number(body.sort) || 0 } };
      await supabase.from('product_categories').insert(row);
      return ok({ id, name: body.name, sort: row.data.sort, createdAt: row.created_at });
    }
    const cid = segs[1];
    if (cid && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      await supabase.from('product_categories').delete().eq('id', cid);
      return ok({ ok: true });
    }
  }

  if (segs[0] === 'products') {
    const toProduct = (r) => ({ ...r.data, id: r.id, categoryId: r.category_id, name: r.name, price: Number(r.price), stock: r.stock, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at });
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_VIEW);
      if (permErr) return permErr;
      const { data: rows } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(400);
      return ok((rows || []).map(toProduct));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.price) return err('name_price_required', 400);
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id, category_id: body.categoryId || null, name: body.name, price: Number(body.price), stock: Number(body.stock) || 0,
        active: body.active !== false, created_at: now, updated_at: now,
        data: { sku: body.sku || `SW-${Date.now().toString(36).toUpperCase()}`, tax: Number(body.tax) || 18, lowStockAt: Number(body.lowStockAt) || 3, images: body.images || [] },
      };
      await supabase.from('products').insert(row);
      const doc = toProduct(row);
      await logActivity(supabase, { actorId: user.id, action: 'product:create', entityType: 'product', entityId: id, after: doc });
      return ok(doc);
    }
    const pid = segs[1];
    if (pid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from('products').select('*').eq('id', pid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, name, price, stock, active, categoryId, ...extra } = body;
      const patch = { updated_at: new Date().toISOString(), data: { ...beforeRow.data, ...extra } };
      if (name !== undefined) patch.name = name;
      if (price !== undefined) patch.price = Number(price);
      if (stock !== undefined) patch.stock = Number(stock);
      if (active !== undefined) patch.active = active;
      if (categoryId !== undefined) patch.category_id = categoryId;
      await supabase.from('products').update(patch).eq('id', pid);
      const { data: afterRow } = await supabase.from('products').select('*').eq('id', pid).single();
      await logActivity(supabase, { actorId: user.id, action: 'product:update', entityType: 'product', entityId: pid, before: toProduct(beforeRow), after: toProduct(afterRow) });
      return ok(toProduct(afterRow));
    }
    if (pid && segs[2] === 'stock' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const delta = Number(body.delta);
      if (!Number.isFinite(delta)) return err('delta_required', 400);
      const { data: cur } = await supabase.from('products').select('stock').eq('id', pid).maybeSingle();
      if (!cur) return err('not_found', 404);
      await supabase.from('products').update({ stock: (cur.stock || 0) + delta, updated_at: new Date().toISOString() }).eq('id', pid);
      const { data: afterRow } = await supabase.from('products').select('*').eq('id', pid).single();
      await logActivity(supabase, { actorId: user.id, action: 'product:stock', entityType: 'product', entityId: pid, after: { delta, stock: afterRow.stock } });
      return ok(toProduct(afterRow));
    }
    if (pid && method === 'DELETE' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (permErr) return permErr;
      const { data: before } = await supabase.from('products').select('*').eq('id', pid).maybeSingle();
      if (!before) return err('not_found', 404);
      await supabase.from('products').delete().eq('id', pid);
      await logActivity(supabase, { actorId: user.id, action: 'product:delete', entityType: 'product', entityId: pid, before: toProduct(before) });
      return ok({ ok: true });
    }
  }

  if (segs[0] === 'orders') {
    const permErr = requirePermission(user, PERMISSIONS.PRODUCTS_VIEW);
    if (permErr) return permErr;
    const { toOrder } = await import('@/lib/db-mappers');

    if (segs.length === 1 && method === 'GET') {
      const url = new URL(req.url);
      const statusQ = url.searchParams.get('status');
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(400);
      if (statusQ) query = query.eq('status', statusQ);
      const { data: rows } = await query;
      return ok((rows || []).map(toOrder));
    }

    const oid = segs[1];
    if (oid && segs.length === 2 && method === 'GET') {
      const { data: row } = await supabase.from('orders').select('*').eq('id', oid).maybeSingle();
      if (!row) return err('not_found', 404);
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', oid).order('created_at', { ascending: true });
      const order = toOrder(row);
      order.items = (items || []).map((it) => ({ id: it.id, productId: it.product_id, name: it.name, price: Number(it.price), qty: it.qty }));
      return ok(order);
    }

    if (oid && segs.length === 2 && method === 'PATCH') {
      const editErr = requirePermission(user, PERMISSIONS.PRODUCTS_EDIT);
      if (editErr) return editErr;
      const { data: beforeRow } = await supabase.from('orders').select('*').eq('id', oid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const patch = { updated_at: new Date().toISOString() };
      const data = { ...beforeRow.data };
      if (body.status || body.trackingNo !== undefined || body.trackingUrl !== undefined) {
        data.trackingEvents = [...(data.trackingEvents || []), {
          status: body.status || beforeRow.status, trackingNo: body.trackingNo || null, trackingUrl: body.trackingUrl || null,
          at: new Date().toISOString(), by: user.email || user.id,
        }];
      }
      if (body.status) patch.status = body.status;
      patch.data = data;
      await supabase.from('orders').update(patch).eq('id', oid);
      const { data: afterRow } = await supabase.from('orders').select('*').eq('id', oid).single();
      await logActivity(supabase, { actorId: user.id, action: 'order:update', entityType: 'order', entityId: oid, before: toOrder(beforeRow), after: toOrder(afterRow) });
      return ok(toOrder(afterRow));
    }
  }

  /* ---------- Payments & Invoices ---------- */
  if (segs[0] === 'payments') {
    const toPayment = (r) => ({ ...r.data, id: r.id, bookingId: r.booking_id, customerId: r.customer_id, amount: Number(r.amount), method: r.method, status: r.status, createdAt: r.created_at });

    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.PAYMENTS_VIEW);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const methodQ = url.searchParams.get('method');
      let query = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(400);
      if (methodQ) query = query.eq('method', methodQ);
      const { data: rows } = await query;
      return ok((rows || []).map(toPayment));
    }

    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PAYMENTS_COLLECT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const total = Number(body.total);
      if (!total || total <= 0) return err('total_required', 400);
      const now = new Date();

      const { data: invNumberRow } = await supabase.rpc('next_invoice_number');
      const invNumber = invNumberRow;
      const gstRate = Number(body.gstRate ?? 18);
      const subtotal = Math.round((total * 100) / (100 + gstRate));
      const taxAmount = total - subtotal;
      const cgst = Math.round(taxAmount / 2);
      const sgst = taxAmount - cgst;

      const paymentId = randomUUID();
      const paymentRow = {
        id: paymentId, booking_id: body.bookingId || null, customer_id: body.customerId || null, amount: total,
        method: body.method || 'cash', status: 'succeeded', created_at: now.toISOString(),
        data: { splits: body.splits || [], ref: body.ref || null, collectedBy: user.id, invoiceNumber: invNumber },
      };
      await supabase.from('payments').insert(paymentRow);

      const invoiceId = randomUUID();
      const invoiceRow = {
        id: invoiceId, number: invNumber, booking_id: body.bookingId || null, customer_id: body.customerId || null,
        customer_name: body.customerName || 'Guest', amount: total, status: 'issued', created_at: now.toISOString(),
        data: {
          gstin: body.customerGstin || null,
          items: body.items || [{ description: body.description || 'Session', qty: 1, unitPrice: subtotal, tax: gstRate, total }],
          subtotal, cgst, sgst, igst: 0, paymentId, paymentMethod: paymentRow.method,
        },
      };
      await supabase.from('invoices').insert(invoiceRow);

      const payment = toPayment(paymentRow);
      const invoice = { ...invoiceRow.data, id: invoiceId, number: invNumber, customerId: invoiceRow.customer_id, customerName: invoiceRow.customer_name, total, createdAt: invoiceRow.created_at };
      await logActivity(supabase, { actorId: user.id, action: 'payment:collect', entityType: 'payment', entityId: paymentId, after: { payment, invoice } });

      return ok({ payment, invoice });
    }

    const pid = segs[1];
    if (pid && segs[2] === 'refund' && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.PAYMENTS_REFUND);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from('payments').select('*').eq('id', pid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const before = toPayment(beforeRow);
      const body = await req.json().catch(() => ({}));
      const amount = Math.min(Number(body.amount) || before.amount, before.amount);
      const refundId = randomUUID();
      const refund = {
        id: refundId, paymentId: pid, amount, reason: body.reason || '', approvedBy: user.id, status: 'refunded', createdAt: new Date().toISOString(),
      };
      await supabase.from('refunds').insert({ id: refundId, payment_id: pid, booking_id: beforeRow.booking_id, amount, status: 'refunded', reason: refund.reason, created_at: refund.createdAt, data: { approvedBy: user.id } });
      await supabase.from('payments').update({ status: 'refunded', data: { ...beforeRow.data, refundedAmount: amount } }).eq('id', pid);
      await logActivity(supabase, { actorId: user.id, action: 'payment:refund', entityType: 'payment', entityId: pid, before, after: refund });
      return ok(refund);
    }
  }

  if (segs[0] === 'invoices') {
    const toInvoice = (r) => ({ ...r.data, id: r.id, number: r.number, customerId: r.customer_id, customerName: r.customer_name, total: Number(r.amount), status: r.status, createdAt: r.created_at });
    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.INVOICES_VIEW);
      if (permErr) return permErr;
      const { data: rows } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(400);
      return ok((rows || []).map(toInvoice));
    }
    const iid = segs[1];
    if (iid && method === 'GET' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.INVOICES_VIEW);
      if (permErr) return permErr;
      const { data: row } = await supabase.from('invoices').select('*').eq('id', iid).maybeSingle();
      if (!row) return err('not_found', 404);
      return ok(toInvoice(row));
    }
  }

  /* ---------- Reports ---------- */
  if (segs[0] === 'reports') {
    const permErr = requirePermission(user, PERMISSIONS.REPORTS_VIEW);
    if (permErr) return permErr;
    const kind = segs[1];
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
    const from = new Date(); from.setDate(from.getDate() - days + 1); from.setHours(0,0,0,0);

    if (kind === 'revenue' && method === 'GET') {
      const { data: rows } = await supabase.from('payments').select('*').gte('created_at', from.toISOString()).neq('status', 'refunded');
      const payments = (rows || []).map((r) => ({ amount: Number(r.amount), method: r.method, createdAt: r.created_at }));
      const daily = bucketByDay(from, days, payments, (p) => p.amount || 0);
      const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const byMethod = payments.reduce((acc, p) => { acc[p.method || 'unknown'] = (acc[p.method || 'unknown'] || 0) + (p.amount || 0); return acc; }, {});
      return ok({ total, daily, byMethod, count: payments.length });
    }

    if (kind === 'bookings' && method === 'GET') {
      const { data: rows } = await supabase.from('bookings').select('status, created_at').gte('created_at', from.toISOString());
      const bookings = (rows || []).map((r) => ({ status: r.status, createdAt: r.created_at }));
      const daily = bucketByDay(from, days, bookings, () => 1);
      const byStatus = bookings.reduce((acc, b) => { acc[b.status || 'unknown'] = (acc[b.status || 'unknown'] || 0) + 1; return acc; }, {});
      return ok({ total: bookings.length, daily, byStatus });
    }

    if (kind === 'occupancy' && method === 'GET') {
      const { data: rows } = await supabase.from('bookings').select('primary_resource_name, created_at').gte('created_at', from.toISOString());
      const bookings = (rows || []).map((r) => ({ resourceName: r.primary_resource_name, createdAt: r.created_at }));
      const byResource = bookings.reduce((acc, b) => { const r = b.resourceName || 'other'; acc[r] = (acc[r] || 0) + 1; return acc; }, {});
      return ok({ byResource, total: bookings.length });
    }

    return err('unknown_report', 404);
  }

  /* ---------- Marketing ---------- */
  if (segs[0] === 'marketing') {
    const sub = segs[1];
    const kinds = ['announcements', 'campaigns', 'reviews', 'testimonials'];
    if (!kinds.includes(sub)) return err('unknown_marketing_kind', 404);
    const permView = requirePermission(user, PERMISSIONS.DASHBOARD_VIEW);
    if (permView) return permView;
    const toRow = (r) => ({ ...r.data, id: r.id, active: r.active, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });

    if (segs.length === 2 && method === 'GET') {
      const { data: rows } = await supabase.from(sub).select('*').order('created_at', { ascending: false }).limit(400);
      return ok((rows || []).map(toRow));
    }
    if (segs.length === 2 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      const id = randomUUID();
      const now = new Date().toISOString();
      const { active, status, ...rest } = body;
      const row = { id, active: active !== false, ...(sub === 'campaigns' ? { status: status || 'draft' } : {}), created_at: now, data: rest };
      await supabase.from(sub).insert(row);
      const doc = toRow(row);
      await logActivity(supabase, { actorId: user.id, action: `${sub}:create`, entityType: sub, entityId: id, after: doc });
      return ok(doc);
    }
    const mid = segs[2];
    if (mid && method === 'PATCH' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from(sub).select('*').eq('id', mid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, active, status, ...rest } = body;
      const patch = { data: { ...beforeRow.data, ...rest } };
      if (active !== undefined) patch.active = active;
      if (status !== undefined) patch.status = status;
      await supabase.from(sub).update(patch).eq('id', mid);
      const { data: afterRow } = await supabase.from(sub).select('*').eq('id', mid).single();
      await logActivity(supabase, { actorId: user.id, action: `${sub}:update`, entityType: sub, entityId: mid, before: toRow(beforeRow), after: toRow(afterRow) });
      return ok(toRow(afterRow));
    }
    if (mid && method === 'DELETE' && segs.length === 3) {
      const permErr = requirePermission(user, PERMISSIONS.MARKETING_EDIT);
      if (permErr) return permErr;
      const { data: before } = await supabase.from(sub).select('*').eq('id', mid).maybeSingle();
      if (!before) return err('not_found', 404);
      await supabase.from(sub).delete().eq('id', mid);
      await logActivity(supabase, { actorId: user.id, action: `${sub}:delete`, entityType: sub, entityId: mid, before: toRow(before) });
      return ok({ ok: true });
    }
  }

  /* ---------- CMS: Media library + Blog posts ---------- */
  if (segs[0] === 'cms') {
    if (segs[1] === 'media') {
      if (segs.length === 2 && method === 'GET') {
        const { data: rows } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false }).limit(400);
        return ok((rows || []).map((r) => ({ ...r.data, id: r.id, url: r.url, kind: r.kind, createdAt: r.created_at })));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const ct = req.headers.get('content-type') || '';
        let doc;
        if (ct.includes('multipart/form-data')) {
          const form = await req.formData();
          const file = form.get('file');
          if (!file) return err('file_required', 400);
          const arrayBuffer = await file.arrayBuffer();
          const { uploadBuffer } = await import('@/lib/s3');
          const up = await uploadBuffer({ buffer: Buffer.from(arrayBuffer), mime: file.type || 'application/octet-stream', filename: file.name || 'file' });
          doc = { id: randomUUID(), url: up.url, key: up.key, storage: up.storage, mime: file.type || 'application/octet-stream', sizeKb: Math.round((file.size || 0) / 1024), alt: String(form.get('alt') || ''), uploadedBy: user.id, createdAt: new Date().toISOString() };
        } else {
          const body = await req.json().catch(() => ({}));
          if (!body.url) return err('url_required', 400);
          doc = { id: randomUUID(), url: body.url, key: body.key || null, storage: 'external', mime: body.mime || 'image/*', sizeKb: Number(body.sizeKb) || 0, alt: body.alt || '', uploadedBy: user.id, createdAt: new Date().toISOString() };
        }
        const { id, url, createdAt, ...rest } = doc;
        await supabase.from('media_assets').insert({ id, url, created_at: createdAt, data: rest });
        await logActivity(supabase, { actorId: user.id, action: 'media:upload', entityType: 'mediaAsset', entityId: id, after: doc });
        return ok(doc);
      }
      const aid = segs[2];
      if (aid && method === 'DELETE') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        await supabase.from('media_assets').delete().eq('id', aid);
        return ok({ ok: true });
      }
    }

    if (segs[1] === 'blog') {
      const toBlog = (r) => ({ ...r.data, id: r.id, slug: r.slug, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });
      if (segs.length === 2 && method === 'GET') {
        const { data: rows } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false }).limit(200);
        return ok((rows || []).map(toBlog));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.title) return err('title_required', 400);
        const now = new Date().toISOString();
        const id = randomUUID();
        const slug = body.slug || slugify(body.title);
        const status = body.status || 'draft';
        const row = { id, slug, status, created_at: now, updated_at: now, data: { title: body.title, excerpt: body.excerpt || '', body: body.body || '', coverUrl: body.coverUrl || '', author: body.author || user.name, category: body.category || 'Wellness', tags: body.tags || [], seo: body.seo || {} } };
        await supabase.from('blog_posts').insert(row);
        const doc = toBlog(row);
        await logActivity(supabase, { actorId: user.id, action: 'blog:create', entityType: 'blog', entityId: id, after: doc });
        return ok(doc);
      }
      const bid = segs[2];
      if (bid && method === 'GET' && segs.length === 3) {
        const { data: row } = await supabase.from('blog_posts').select('*').eq('id', bid).maybeSingle();
        if (!row) return err('not_found', 404);
        return ok(toBlog(row));
      }
      if (bid && method === 'PATCH' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const { data: beforeRow } = await supabase.from('blog_posts').select('*').eq('id', bid).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        const body = await req.json().catch(() => ({}));
        const { id: _id, slug, status, ...rest } = body;
        const patch = { updated_at: new Date().toISOString(), data: { ...beforeRow.data, ...rest } };
        if (slug !== undefined) patch.slug = slug;
        if (status !== undefined) patch.status = status;
        await supabase.from('blog_posts').update(patch).eq('id', bid);
        const { data: afterRow } = await supabase.from('blog_posts').select('*').eq('id', bid).single();
        return ok(toBlog(afterRow));
      }
      if (bid && method === 'DELETE' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        await supabase.from('blog_posts').delete().eq('id', bid);
        return ok({ ok: true });
      }
    }

    // Mini-blogs — short-form insights / social-tile posts surfaced on the homepage strip.
    if (segs[1] === 'mini-blog' || segs[1] === 'mini-blogs') {
      const toMini = (r) => ({ ...r.data, id: r.id, order: r.order, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });
      if (segs.length === 2 && method === 'GET') {
        const { data: rows } = await supabase.from('mini_blog_posts').select('*').order('order', { ascending: true }).order('created_at', { ascending: false }).limit(200);
        return ok((rows || []).map(toMini));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.title) return err('title_required', 400);
        const now = new Date().toISOString();
        const id = randomUUID();
        const row = { id, status: body.status || 'draft', order: Number.isFinite(Number(body.order)) ? Number(body.order) : 0, created_at: now, updated_at: now, data: { title: body.title, body: body.body || '', imageUrl: body.imageUrl || '', linkHref: body.linkHref || '', linkLabel: body.linkLabel || '', tag: body.tag || '' } };
        await supabase.from('mini_blog_posts').insert(row);
        const doc = toMini(row);
        await logActivity(supabase, { actorId: user.id, action: 'mini_blog:create', entityType: 'mini_blog', entityId: id, after: doc });
        return ok(doc);
      }
      const mid = segs[2];
      if (mid && segs.length === 3 && method === 'GET') {
        const { data: row } = await supabase.from('mini_blog_posts').select('*').eq('id', mid).maybeSingle();
        if (!row) return err('not_found', 404);
        return ok(toMini(row));
      }
      if (mid && segs.length === 3 && method === 'PATCH') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        const { data: beforeRow } = await supabase.from('mini_blog_posts').select('*').eq('id', mid).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        const body = await req.json().catch(() => ({}));
        const { id: _id, order, status, ...rest } = body;
        const patch = { updated_at: new Date().toISOString(), data: { ...beforeRow.data, ...rest } };
        if (order !== undefined) patch.order = Number(order) || 0;
        if (status !== undefined) patch.status = status;
        await supabase.from('mini_blog_posts').update(patch).eq('id', mid);
        const { data: afterRow } = await supabase.from('mini_blog_posts').select('*').eq('id', mid).single();
        await logActivity(supabase, { actorId: user.id, action: 'mini_blog:update', entityType: 'mini_blog', entityId: mid, before: toMini(beforeRow), after: toMini(afterRow) });
        return ok(toMini(afterRow));
      }
      if (mid && segs.length === 3 && method === 'DELETE') {
        const permErr = requirePermission(user, PERMISSIONS.CMS_EDIT);
        if (permErr) return permErr;
        await supabase.from('mini_blog_posts').delete().eq('id', mid);
        await logActivity(supabase, { actorId: user.id, action: 'mini_blog:delete', entityType: 'mini_blog', entityId: mid });
        return ok({ ok: true });
      }
    }
  }

  /* ---------- Notifications (templates + logs; send is stubbed) ---------- */
  if (segs[0] === 'notifications') {
    if (segs[1] === 'providers' && segs.length === 2) {
      if (method === 'GET') {
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'notification_providers').maybeSingle();
        const v = row?.value || {};
        const { gallaboxIsConfigured } = await import('@/lib/notifications/gallabox');
        const { bhashSmsIsConfigured } = await import('@/lib/notifications/bhashsms');
        const { whatsappIsConfigured } = await import('@/lib/whatsapp');
        const [gb, bs, meta] = await Promise.all([gallaboxIsConfigured(), bhashSmsIsConfigured(), whatsappIsConfigured()]);
        return ok({
          whatsapp: v.whatsapp || 'gallabox', sms: v.sms || 'bhashsms',
          available: { whatsapp: { gallabox: gb, meta_cloud: meta }, sms: { bhashsms: bs } },
        });
      }
      if (method === 'PUT') {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        const next = {
          whatsapp: ['gallabox', 'meta_cloud'].includes(body.whatsapp) ? body.whatsapp : 'gallabox',
          sms: ['bhashsms'].includes(body.sms) ? body.sms : 'bhashsms',
        };
        await supabase.from('app_settings').upsert({ key: 'notification_providers', value: next, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        await logActivity(supabase, { actorId: user.id, action: 'notifications:providers:update', entityType: 'settings', entityId: 'notification_providers', after: next });
        return ok(next);
      }
    }

    if (segs[1] === 'retry' && segs[2] && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
      if (permErr) return permErr;
      const { retry } = await import('@/lib/notifications');
      return ok(await retry(segs[2]));
    }

    if (segs[1] === 'templates') {
      const toTpl = (r) => ({ ...r.data, id: r.id, key: r.key, channel: r.channel, createdAt: r.created_at, updatedAt: r.updated_at });
      if (segs.length === 2 && method === 'GET') {
        const { data: rows } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
        return ok((rows || []).map(toTpl));
      }
      if (segs.length === 2 && method === 'POST') {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        if (!body.key || !body.channel) return err('key_channel_required', 400);
        const id = randomUUID();
        const row = { id, key: body.key, channel: body.channel, created_at: new Date().toISOString(), data: { subject: body.subject || '', body: body.body || '', variables: body.variables || [], active: body.active !== false, name: body.name, language: body.language } };
        await supabase.from('templates').insert(row);
        return ok(toTpl(row));
      }
      const tid = segs[2];
      if (tid && method === 'PATCH' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        const { data: beforeRow } = await supabase.from('templates').select('*').eq('id', tid).maybeSingle();
        if (!beforeRow) return err('not_found', 404);
        const body = await req.json().catch(() => ({}));
        const { id: _id, key, channel, ...rest } = body;
        const patch = { updated_at: new Date().toISOString(), data: { ...beforeRow.data, ...rest } };
        if (key !== undefined) patch.key = key;
        if (channel !== undefined) patch.channel = channel;
        await supabase.from('templates').update(patch).eq('id', tid);
        const { data: afterRow } = await supabase.from('templates').select('*').eq('id', tid).single();
        return ok(toTpl(afterRow));
      }
      if (tid && method === 'DELETE' && segs.length === 3) {
        const permErr = requirePermission(user, PERMISSIONS.NOTIFICATIONS_EDIT);
        if (permErr) return permErr;
        await supabase.from('templates').delete().eq('id', tid);
        return ok({ ok: true });
      }
    }

    if (segs[1] === 'logs' && method === 'GET') {
      const { data: rows } = await supabase.from('communications').select('*').order('created_at', { ascending: false }).limit(200);
      return ok((rows || []).map((r) => ({ ...r.data, id: r.id, customerId: r.customer_id, channel: r.channel, status: r.status, sentAt: r.created_at })));
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
      let providerUsed = null;

      if ((channel === 'whatsapp' || channel === 'sms') && body.to) {
        try {
          if (channel === 'whatsapp') {
            const { data: provRow } = await supabase.from('app_settings').select('value').eq('key', 'notification_providers').maybeSingle();
            providerUsed = provRow?.value?.whatsapp || 'gallabox';
            if (providerUsed === 'gallabox') {
              const { sendGallaboxTemplate } = await import('@/lib/notifications/gallabox');
              sendResult = await sendGallaboxTemplate({ to: body.to, name: body.name || 'Customer', templateKey: body.templateKey || body.templateId, templateName: body.templateName, variables: body.variables || body.payload || {}, orderedVariables: body.orderedVariables });
            } else {
              const { sendWhatsappTemplate } = await import('@/lib/whatsapp');
              sendResult = await sendWhatsappTemplate({ to: body.to, templateKey: body.templateKey || body.templateId, templateName: body.templateName, languageCode: body.languageCode || 'en', variables: body.variables || body.payload || {}, orderedVariables: body.orderedVariables });
            }
          } else if (channel === 'sms') {
            providerUsed = 'bhashsms';
            const { sendBhashSms } = await import('@/lib/notifications/bhashsms');
            sendResult = await sendBhashSms({ to: body.to, text: body.text, templateKey: body.templateKey || body.templateId, variables: body.variables || body.payload || {} });
          }
          if (sendResult?.queued) { status = 'sent'; providerRef = sendResult.messageId || null; }
          else { status = 'failed'; errorNote = sendResult?.error || 'send_failed'; }
        } catch (e) { status = 'failed'; errorNote = String(e?.message || e); }
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      const doc = {
        id, customerId: body.customerId || null, to: body.to || null, channel, provider: providerUsed,
        templateId: body.templateId || body.templateKey || null, payload: body.payload || body.variables || {},
        status, providerRef, sentBy: user.id, sentAt: now,
        note: errorNote || (channel === 'email' ? 'Email provider not wired yet. Queued in local log.' : null),
      };
      await supabase.from('communications').insert({ id, customer_id: doc.customerId, channel, status, created_at: now, data: { to: doc.to, provider: providerUsed, templateId: doc.templateId, payload: doc.payload, providerRef, sentBy: user.id, note: doc.note } });
      return ok(doc);
    }
  }

  /* ---------- Settings ---------- */
  if (segs[0] === 'settings') {
    if (segs[1] === 'booking-rules' && segs.length === 2) {
      if (method === 'GET') {
        const { loadBookingRules } = await import('@/lib/booking-rules');
        return ok(await loadBookingRules());
      }
      if (method === 'PUT') {
        const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
        if (permErr) return permErr;
        const body = await req.json().catch(() => ({}));
        const { saveBookingRules } = await import('@/lib/booking-rules');
        const next = await saveBookingRules(body, user.id);
        await logActivity(supabase, { actorId: user.id, action: 'settings:bookingRules:update', entityType: 'settings', entityId: 'bookingRules', after: next });
        return ok(next);
      }
    }
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('app_settings').select('*');
      const out = {};
      for (const d of rows || []) out[d.key] = d.value;
      return ok(out);
    }
    const key = segs[1];
    if (key && method === 'GET' && segs.length === 2) {
      const { data: row } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
      return ok(row ? row.value : null);
    }
    if (key && method === 'PUT' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      await supabase.from('app_settings').upsert({ key, value: body, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      await logActivity(supabase, { actorId: user.id, action: `settings:${key}:update`, entityType: 'settings', entityId: key, after: body });
      return ok({ ok: true, key, value: body });
    }
  }

  /* ---------- Calendar Blocks (day/half-day/range × branch/therapy/resource) ---------- */
  if (segs[0] === 'calendar-blocks') {
    const { createBlock, listBlocks, deleteBlock, BLOCK_SCOPES, BLOCK_REASONS } = await import('@/lib/calendar-blocks');

    if (segs.length === 1 && method === 'GET') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_CALENDAR);
      if (permErr) return permErr;
      const url = new URL(req.url);
      const blocks = await listBlocks({ from: url.searchParams.get('from'), to: url.searchParams.get('to'), branchId: url.searchParams.get('branchId') || null });
      return ok(blocks);
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_CALENDAR);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.reason)   return err('reason_required', 400);
      if (!body.startAt)  return err('startAt_required', 400);
      if (!body.endAt)    return err('endAt_required', 400);
      if (!BLOCK_SCOPES.includes(body.scope)) return err('scope_required', 400);
      if (!BLOCK_REASONS.includes(body.reason)) return err('invalid_reason', 400);
      let branchId = body.branchId ?? null;
      if (branchId === null && body.scope !== 'branch') {
        try {
          const { getCurrentBranchFromCookies } = await import('@/lib/branches');
          const b = await getCurrentBranchFromCookies();
          branchId = b?.id || null;
        } catch { /* noop */ }
      }
      try {
        const doc = await createBlock({ ...body, branchId, createdBy: user.id });
        await logActivity(supabase, { actorId: user.id, action: 'calendar_block:create', entityType: 'calendar_block', entityId: doc.id, after: doc });
        return ok(doc);
      } catch (e) { return err(e.message || 'create_failed', 400); }
    }
    const bid = segs[1];
    if (bid && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.BOOKINGS_CALENDAR);
      if (permErr) return permErr;
      const { data: before } = await supabase.from('calendar_blocks').select('id').eq('id', bid).maybeSingle();
      if (!before) return err('not_found', 404);
      await deleteBlock(bid);
      await logActivity(supabase, { actorId: user.id, action: 'calendar_block:delete', entityType: 'calendar_block', entityId: bid, before });
      return ok({ ok: true });
    }
  }

  /* ---------- Resources (rooms / equipment) ---------- */
  if (segs[0] === 'resources') {
    const toResourceDoc = (r) => ({ ...r.data, id: r.id, name: r.name, type: r.type, capacity: r.capacity, supportedModes: r.supported_modes || [], branchId: r.branch_id, active: r.active, createdAt: r.created_at });
    if (segs.length === 1 && method === 'GET') {
      const branchIdQ = new URL(req.url).searchParams.get('branchId');
      let query = supabase.from('resources').select('*').order('created_at', { ascending: true });
      if (branchIdQ) query = query.eq('branch_id', branchIdQ);
      const { data: rows } = await query;
      return ok((rows || []).map(toResourceDoc));
    }
    if (segs.length === 1 && method === 'POST') {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      const body = await req.json().catch(() => ({}));
      if (!body.name || !body.type) return err('name_type_required', 400);
      let branchId = body.branchId || null;
      if (!branchId) {
        try {
          const { getCurrentBranchFromCookies } = await import('@/lib/branches');
          const b = await getCurrentBranchFromCookies();
          branchId = b?.id || null;
        } catch { /* fall through */ }
      }
      const id = randomUUID();
      const row = {
        id, name: body.name, type: body.type, capacity: Number(body.capacity) || 1,
        supported_modes: Array.isArray(body.supportedModes) && body.supportedModes.length > 0 ? body.supportedModes.filter((m) => ['single', 'couple'].includes(m)) : ['single', 'couple'],
        branch_id: branchId, active: body.active !== false, created_at: new Date().toISOString(),
      };
      await supabase.from('resources').insert(row);
      if (body.therapySlug) {
        const { data: t } = await supabase.from('therapies').select('id').eq('slug', body.therapySlug).maybeSingle();
        if (t) await supabase.from('therapy_resources').insert({ therapy_id: t.id, resource_id: id });
      }
      return ok(toResourceDoc(row));
    }
    const rid = segs[1];
    if (rid && method === 'PATCH' && segs.length === 2) {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      const { data: beforeRow } = await supabase.from('resources').select('*').eq('id', rid).maybeSingle();
      if (!beforeRow) return err('not_found', 404);
      const body = await req.json().catch(() => ({}));
      const { id: _id, name, type, capacity, supportedModes, branchId, active, ...extra } = body;
      const patch = { data: { ...beforeRow.data, ...extra } };
      if (name !== undefined) patch.name = name;
      if (type !== undefined) patch.type = type;
      if (capacity !== undefined) patch.capacity = Number(capacity);
      if (supportedModes !== undefined) patch.supported_modes = supportedModes;
      if (branchId !== undefined) patch.branch_id = branchId;
      if (active !== undefined) patch.active = active;
      await supabase.from('resources').update(patch).eq('id', rid);
      const { data: afterRow } = await supabase.from('resources').select('*').eq('id', rid).single();
      return ok(toResourceDoc(afterRow));
    }
    if (rid && method === 'DELETE') {
      const permErr = requirePermission(user, PERMISSIONS.SETTINGS_EDIT_BRAND);
      if (permErr) return permErr;
      await supabase.from('resources').delete().eq('id', rid);
      return ok({ ok: true });
    }
  }

  /* ---------- Integrations (API keys — masked read, super-admin write) ---------- */
  if (segs[0] === 'integrations') {
    if (segs.length === 1 && method === 'GET') {
      const { data: rows } = await supabase.from('integrations').select('*');
      const masked = (rows || []).map((d) => {
        const value = { ...(d.value?.config || {}) };
        for (const k of Object.keys(value)) {
          if (/secret|key|token|password/i.test(k) && typeof value[k] === 'string' && value[k]) {
            value[k] = '•'.repeat(Math.max(6, value[k].length - 4)) + value[k].slice(-4);
          }
        }
        return { key: d.key, config: value, status: d.value?.status, updatedAt: d.updated_at, configured: Object.values(d.value?.config || {}).some(Boolean) };
      });
      return ok(masked);
    }
    if (segs.length === 2 && method === 'PUT') {
      if (user.role !== 'super_admin') return err('forbidden', 403);
      const key = segs[1];
      const body = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      await supabase.from('integrations').upsert({ key, value: { config: body, status: 'configured', updatedBy: user.id }, updated_at: now }, { onConflict: 'key' });
      await logActivity(supabase, { actorId: user.id, action: 'integration:update', entityType: 'integration', entityId: key });
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

function slugify(s) {
  return (s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
