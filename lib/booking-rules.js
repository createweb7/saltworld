// Salt World — Booking rules engine (unified: CREATE + cancel + reschedule).
//
// Source of truth for ALL booking eligibility gates. Consumed by:
//   • /lib/scheduling.js         (recommendations)
//   • POST /api/bookings         (server-side validation before insert)
//   • /app/book (BookingClient)  (UX hints; the frontend never allows anything
//                                 the server would reject)
//
// RULE CATEGORIES
// ---------------
// 1. minLeadTimeMin — per-therapy lead time (default 30, float=90).
//    A booking's startAt must be ≥ now + minLeadTimeMin.
//
// 2. nextDayEarlyCutoff — after `cutoffHourIst` on day X, the "early slots"
//    of day X+1 (up through `cutoffTime`) become unbookable. Two buckets
//    supported:
//      { slugs:[salt-therapy, red-light-therapy, infrared-sauna], cutoffTime:'08:30' }
//      { slugs:[float-therapy, cold-plunge, hot-cold-contrast],   cutoffTime:'09:00' }
//
// 3. closeBufferMin — a session may not START within this many minutes of
//    the branch's actual closing time that day (default 60). Replaces two
//    earlier, inconsistent rules (a fixed same-day 19:00→20:00 cutoff, and a
//    fixed per-therapy last-slot independent of closing time) with one rule
//    that's always relative to when the branch actually closes.
//
// 4. cancelReschedule — legacy customer-mutation cutoff (kept as-is).
//
// All rules are settings-driven; no hardcoding in the engine's callers.

import { getSupabase } from '@/lib/supabase';
import { getBranchById, getDefaultBranch } from '@/lib/branches';

const IST_OFFSET_MIN = 330;
export const DEFAULT_CUTOFF_TIME = '21:00';

// -----------------------------------------------------------------------------
// Defaults (matches product spec 25-Aug-2026)
// -----------------------------------------------------------------------------
const DEFAULT_MIN_LEAD_MIN = 30;

const DEFAULT_PER_THERAPY_LEAD = {
  'float-therapy':      90,
  'salt-therapy':       30,
  'red-light-therapy':  30,
  'infrared-sauna':     30,
  'cold-plunge':        30,
  'hot-cold-contrast':  30,
};

const DEFAULT_NEXT_DAY_EARLY_CUTOFF = {
  cutoffHourIst: 21, // "after 9 PM"
  buckets: [
    { slugs: ['salt-therapy', 'red-light-therapy', 'infrared-sauna'],   cutoffTime: '08:30' },
    { slugs: ['float-therapy', 'cold-plunge', 'hot-cold-contrast'],     cutoffTime: '09:00' },
  ],
};

// A session can't START within this many minutes of the branch's actual
// closing time that day (e.g. closes 23:30 → last start 22:30).
const DEFAULT_CLOSE_BUFFER_MIN = 60;
const DEFAULT_CLOSE_TIME_FALLBACK = '21:00'; // only if no branch hours AND no global scheduling config exist
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Resolves the HH:mm the branch actually closes on the given IST calendar
// day (branch.hours override, falling back to the global scheduling
// setting). Returns null if the branch is closed that weekday.
async function resolveCloseTimeHHmm(branchId, dayYmd) {
  const supabase = getSupabase();
  const [{ data: schedRow }, branch] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'scheduling').maybeSingle(),
    branchId ? getBranchById(branchId) : getDefaultBranch(),
  ]);
  const globalClose = schedRow?.value?.closeTime || DEFAULT_CLOSE_TIME_FALLBACK;
  const wk = WEEKDAY_KEYS[new Date(`${dayYmd}T12:00:00Z`).getUTCDay()];
  const bh = branch?.hours?.[wk];
  if (bh && bh.open === false) return null;
  return (bh && bh.to) || globalClose;
}

// -----------------------------------------------------------------------------
// Load / save
// -----------------------------------------------------------------------------
export async function loadBookingRules() {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'bookingRules').maybeSingle();
  const value = row?.value || {};
  return {
    // legacy cancel/reschedule
    cutoffTime:              value.cutoffTime || DEFAULT_CUTOFF_TIME,
    cutoffDaysBefore:        Number(value.cutoffDaysBefore ?? 1),
    minRescheduleNoticeMin:  Number(value.minRescheduleNoticeMin || 0),
    // NEW — booking creation gates
    defaultMinLeadTimeMin:   Number(value.defaultMinLeadTimeMin ?? DEFAULT_MIN_LEAD_MIN),
    perTherapyLeadMin:       Object.assign({}, DEFAULT_PER_THERAPY_LEAD, value.perTherapyLeadMin || {}),
    nextDayEarlyCutoff:      value.nextDayEarlyCutoff || DEFAULT_NEXT_DAY_EARLY_CUTOFF,
    closeBufferMin:          Number(value.closeBufferMin ?? DEFAULT_CLOSE_BUFFER_MIN),
  };
}

export async function saveBookingRules(patch, actorId = null) {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const cur = (await loadBookingRules());
  const next = {
    cutoffTime:             patch.cutoffTime            || cur.cutoffTime,
    cutoffDaysBefore:       Number(patch.cutoffDaysBefore       ?? cur.cutoffDaysBefore),
    minRescheduleNoticeMin: Number(patch.minRescheduleNoticeMin ?? cur.minRescheduleNoticeMin),
    defaultMinLeadTimeMin:  Number(patch.defaultMinLeadTimeMin  ?? cur.defaultMinLeadTimeMin),
    perTherapyLeadMin:      patch.perTherapyLeadMin      || cur.perTherapyLeadMin,
    nextDayEarlyCutoff:     patch.nextDayEarlyCutoff     || cur.nextDayEarlyCutoff,
    closeBufferMin:         Number(patch.closeBufferMin  ?? cur.closeBufferMin),
  };
  const { error } = await supabase.from('app_settings').upsert({
    key: 'bookingRules', value: next, updated_by: actorId, updated_at: now,
  }, { onConflict: 'key' });
  if (error) throw error;
  return next;
}

// -----------------------------------------------------------------------------
// Cancel/reschedule cutoff (unchanged)
// -----------------------------------------------------------------------------
export function computeCutoffForBooking(bookingStartIso, rules) {
  const start = new Date(bookingStartIso);
  const istMs = start.getTime() + IST_OFFSET_MIN * 60000;
  const ist = new Date(istMs);
  const [h, m] = String(rules.cutoffTime || DEFAULT_CUTOFF_TIME).split(':').map(Number);
  ist.setUTCDate(ist.getUTCDate() - Number(rules.cutoffDaysBefore || 1));
  ist.setUTCHours(h, m, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MIN * 60000);
}

export async function assertCustomerCanMutate(booking, action = 'cancel') {
  if (!booking?.startAt) return { ok: true, reason: 'no_start' };
  const rules = await loadBookingRules();
  const cutoff = computeCutoffForBooking(booking.startAt, rules);
  const now = new Date();
  if (now.getTime() > cutoff.getTime()) {
    const errObj = new Error(`${action}_cutoff_passed`);
    errObj.code    = 'cutoff_passed';
    errObj.cutoff  = cutoff.toISOString();
    errObj.rules   = rules;
    throw errObj;
  }
  return { ok: true, cutoff: cutoff.toISOString() };
}

// -----------------------------------------------------------------------------
// UTILITY — IST helpers (fixed offset, no DST)
// -----------------------------------------------------------------------------
function toIst(date) { return new Date(date.getTime() + IST_OFFSET_MIN * 60000); }
function istHhmmForDate(dateIsoYmd, hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const utc = new Date(`${dateIsoYmd}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);
  utc.setUTCMinutes(utc.getUTCMinutes() - IST_OFFSET_MIN);
  return utc;
}
function istDayYmd(date) {
  const ist = toIst(date);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,'0')}-${String(ist.getUTCDate()).padStart(2,'0')}`;
}

// -----------------------------------------------------------------------------
// Cross-service buffer for INDEPENDENT bookings.
//
// When a customer books therapy B on the same day as an existing therapy A
// booking, therapy B's start must be ≥ A.end + A.crossBufferMin. (This is
// separate from `cleaningBufferMin` which applies to the resource lock.)
//
// Cross-service buffer matrix (per "Rules for Booking" spec) — customer
// transition gap:
//   salt-therapy      → 15 min
//   kids-salt-therapy → 15 min
//   float-therapy     → 30 min
//   red-light-therapy → 15 min
//   infrared-sauna    → 20 min
//   cold-plunge       → 20 min
//   hot-cold-contrast → 30 min
//
// The engine also applies the buffer symmetrically — if B ends before A
// starts, A.start must be ≥ B.end + B.crossBufferMin.
// -----------------------------------------------------------------------------

const CROSS_SERVICE_BUFFER_MIN = {
  'salt-therapy':      15,
  'kids-salt-therapy': 15,
  'float-therapy':     30,
  'red-light-therapy': 15,
  'infrared-sauna':    20,
  'cold-plunge':       20,
  'hot-cold-contrast': 30,
};

/**
 * Look up existing bookings for this customer (matched by customerId or
 * normalized phone) on the same IST day and enforce cross-service buffer.
 *
 * Returns { ok: true } or { ok: false, code: 'cross_service_buffer', message, meta }.
 */
export async function assertCrossServiceBuffer({
  therapies = [],           // slugs
  startIso,                 // ISO of the FIRST step (visitFrom)
  endIso,                   // ISO of the LAST step  (visitTo)
  customerId = null,
  phone = null,
  excludeBookingId = null,
} = {}) {
  if (!startIso || !endIso) return { ok: true };
  if (!customerId && !phone) return { ok: true };
  const supabase = getSupabase();
  const start = new Date(startIso);
  const end   = new Date(endIso);
  const dayYmd = istDayYmd(start);

  const ors = [];
  if (customerId) ors.push(`customer_id.eq.${customerId}`);
  if (phone) {
    const digits = String(phone).replace(/\D/g, '');
    const phones = new Set([phone, digits]);
    if (digits.length > 10) phones.add(digits.slice(-10));
    ors.push(`contact_phone.in.(${[...phones].join(',')})`);
  }
  if (ors.length === 0) return { ok: true };

  const dayStart = istHhmmForDate(dayYmd, '00:00');
  const dayEnd   = istHhmmForDate(dayYmd, '23:59');
  let query = supabase.from('bookings')
    .select('id, start_at, blocked_to, booking_schedule_items(therapy_slug, starts_at, ends_at, position)')
    .not('status', 'in', '(cancelled,no_show)')
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString())
    .or(ors.join(','));
  if (excludeBookingId) query = query.neq('id', excludeBookingId);
  const { data: rows, error } = await query;
  if (error) throw error;

  // Load therapy durations so we can compute the SESSION end (not the
  // room-lock end which includes cleaning). Customer transition gap must
  // start from the moment the customer is done, not the resource.
  const involvedSlugs = new Set(therapies);
  const firstStepBySlug = new Map();
  for (const b of rows || []) {
    const steps = [...(b.booking_schedule_items || [])].sort((a, b2) => (a.position || 0) - (b2.position || 0));
    const first = steps[0];
    firstStepBySlug.set(b.id, first);
    if (first?.therapy_slug) involvedSlugs.add(first.therapy_slug);
  }
  const { data: therapyDocs } = await supabase.from('therapies').select('slug, duration_min').in('slug', [...involvedSlugs]);
  const durBySlug = Object.fromEntries((therapyDocs || []).map((t) => [t.slug, Number(t.duration_min) || 60]));

  const candidateSlug = therapies[0];
  const candidateBufMin = Number(CROSS_SERVICE_BUFFER_MIN[candidateSlug]) || 0;

  for (const b of rows || []) {
    const first = firstStepBySlug.get(b.id);
    const bStart = new Date(first?.starts_at || b.start_at);
    const bSlug  = first?.therapy_slug || null;
    // Session end = start + therapy duration (excludes cleaning buffer). The
    // customer becomes free the moment their session ends, not when the room
    // finishes cleaning. Fall back to blockedTo if we can't resolve duration.
    const durMin = durBySlug[bSlug];
    const bSessionEnd = durMin
      ? new Date(bStart.getTime() + durMin * 60000)
      : new Date(b.blocked_to || bStart.getTime() + 60 * 60000);
    const bBufMin = Number(CROSS_SERVICE_BUFFER_MIN[bSlug]) || 0;
    const effectiveBufMin = Math.max(bBufMin, candidateBufMin);

    // Same therapy = no cross-service check (intra-service handled by engine).
    if (bSlug && bSlug === candidateSlug) continue;

    // Case 1: candidate starts AFTER existing session end → +buffer
    if (start.getTime() >= bSessionEnd.getTime()) {
      const requiredStart = new Date(bSessionEnd.getTime() + effectiveBufMin * 60000);
      if (start.getTime() < requiredStart.getTime()) {
        return {
          ok: false, code: 'cross_service_buffer',
          message: `You have a ${bSlug || 'therapy'} that ends at ${bSessionEnd.toISOString().slice(11,16)} UTC. Please leave at least ${effectiveBufMin} minutes between different therapies (earliest next start: ${requiredStart.toISOString().slice(11,16)} UTC).`,
          meta: { conflictWithBookingId: b.id, conflictSlug: bSlug, effectiveBufMin, requiredStart: requiredStart.toISOString() },
        };
      }
    }
    // Case 2: candidate ends BEFORE existing session start
    else if (end.getTime() <= bStart.getTime()) {
      const requiredExistingStart = new Date(end.getTime() + effectiveBufMin * 60000);
      if (bStart.getTime() < requiredExistingStart.getTime()) {
        return {
          ok: false, code: 'cross_service_buffer',
          message: `Your existing ${bSlug || 'therapy'} at ${bStart.toISOString().slice(11,16)} UTC is too close to this session. Please leave at least ${effectiveBufMin} minutes between different therapies.`,
          meta: { conflictWithBookingId: b.id, conflictSlug: bSlug, effectiveBufMin },
        };
      }
    }
    // Case 3: overlap
    else {
      return {
        ok: false, code: 'cross_service_buffer',
        message: `You already have a ${bSlug || 'therapy'} that overlaps this time. Please pick a different slot.`,
        meta: { conflictWithBookingId: b.id, conflictSlug: bSlug },
      };
    }
  }
  return { ok: true };
}

// A booking made with payment:'online' is created as 'payment_pending' and
// only flips to 'confirmed' once Razorpay verifies payment (see
// /api/payments/verify-signature). If the customer abandons or fails
// checkout, nothing else ever revisits that row on its own — it would
// otherwise sit forever holding its resource/time slot and showing as a
// live booking. Lazily cancel any that have sat unpaid past the expiry
// window; called opportunistically before availability-sensitive reads
// (new booking attempts, the admin bookings list) so stale holds self-heal
// without needing a cron worker.
export const PAYMENT_PENDING_EXPIRY_MIN = 7;

export async function expireStalePendingBookings() {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - PAYMENT_PENDING_EXPIRY_MIN * 60000).toISOString();
  await supabase.from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('status', 'payment_pending')
    .lt('created_at', cutoff);
}

//
// therapies:  ['float-therapy', 'salt-therapy']  (ordered slugs)
// startIso:   ISO string of first therapy start (or visit-from — the check
//             uses startIso as the earliest touched moment).
// nowIso?:    optional override for testing.
//
// Returns { ok:true } or { ok:false, code, message, meta }.
// -----------------------------------------------------------------------------
// `preloadedRules` lets a hot loop (e.g. the availableJourneySlots scan over
// every 15-min slot in a day) load booking rules ONCE and reuse them across
// many calls, instead of re-querying app_settings on every candidate.
// `branchId` scopes the closing-time lookup; `closeTimeHHmm` lets a hot-loop
// caller (already holding that day's resolved branch hours) skip the lookup
// entirely by passing it straight through.
export async function assertCanBook({ therapies = [], startIso, nowIso = null, preloadedRules = null, branchId = null, closeTimeHHmm = null } = {}) {
  if (!Array.isArray(therapies) || therapies.length === 0) {
    return { ok: false, code: 'no_therapies', message: 'Select at least one therapy.' };
  }
  if (!startIso) {
    return { ok: false, code: 'no_start', message: 'Pick a start time.' };
  }
  const rules   = preloadedRules || await loadBookingRules();
  const now     = nowIso ? new Date(nowIso) : new Date();
  const start   = new Date(startIso);
  if (isNaN(start.getTime())) {
    return { ok: false, code: 'bad_start', message: 'Invalid start time.' };
  }
  if (start.getTime() < now.getTime()) {
    return { ok: false, code: 'past_time', message: 'Cannot book a past time.' };
  }

  // ---- 1. Per-therapy min lead time ----------------------------------------
  // Take the STRICTEST lead time across the selected therapies.
  const perTherapy = rules.perTherapyLeadMin || {};
  const requiredLeadMin = therapies.reduce((max, slug) => {
    const lead = Number(perTherapy[slug]) || rules.defaultMinLeadTimeMin || DEFAULT_MIN_LEAD_MIN;
    return Math.max(max, lead);
  }, 0);
  const minStartMs = now.getTime() + requiredLeadMin * 60000;
  if (start.getTime() < minStartMs) {
    return {
      ok: false, code: 'below_min_lead_time',
      message: `Please book at least ${requiredLeadMin} minutes in advance for this therapy.`,
      meta: { requiredLeadMin, earliestStartIso: new Date(minStartMs).toISOString() },
    };
  }

  // ---- 2. Early-morning cutoff --------------------------------------------
  // For any slot at time T on day D that is at or before the bucket's cutoff
  // time (e.g., 08:30), the booking deadline is day D-1 at ndc.cutoffHourIst
  // (default 21:00) IST. If `now` is past that deadline, the slot is blocked.
  // This covers BOTH the "after 21:00 previous night" and the "same-day
  // morning" (e.g., 07:26 AM) scenarios uniformly.
  const ndc = rules.nextDayEarlyCutoff || DEFAULT_NEXT_DAY_EARLY_CUTOFF;
  for (const bucket of ndc.buckets || []) {
    const bucketSlugs = new Set(bucket.slugs || []);
    const relevant = therapies.some((s) => bucketSlugs.has(s));
    if (!relevant) continue;
    const slotDayYmd = istDayYmd(start);
    const bucketCutoffUtc = istHhmmForDate(slotDayYmd, bucket.cutoffTime);
    // Rule only concerns "early" slots (start ≤ bucket.cutoffTime IST).
    if (start.getTime() > bucketCutoffUtc.getTime()) continue;
    // Deadline = previous day's ndc.cutoffHourIst in IST.
    const prevDay = new Date(start.getTime()); prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const prevDayYmd = istDayYmd(prevDay);
    const deadlineUtc = istHhmmForDate(prevDayYmd, `${String(ndc.cutoffHourIst).padStart(2,'0')}:00`);
    if (now.getTime() > deadlineUtc.getTime()) {
      return {
        ok: false, code: 'next_day_early_cutoff',
        message: `Sessions at or before ${bucket.cutoffTime} must be booked before ${String(ndc.cutoffHourIst).padStart(2,'0')}:00 the previous night. Please pick a later time.`,
        meta: { bucket, deadlineIso: deadlineUtc.toISOString() },
      };
    }
  }

  // ---- 3. Last bookable start = closing time minus a buffer ---------------
  // A session can't start within `closeBufferMin` minutes of the branch's
  // actual closing time that day (default 60 — e.g. closes 23:30 → last
  // start 22:30). Replaces the old fixed same-day/per-therapy cutoffs, which
  // were hardcoded independent of the branch's real closing hour.
  const closeBufferMin = Number(rules.closeBufferMin ?? DEFAULT_CLOSE_BUFFER_MIN);
  const slotDayYmd = istDayYmd(start);
  const closeHHmm = closeTimeHHmm != null ? closeTimeHHmm : await resolveCloseTimeHHmm(branchId, slotDayYmd);
  if (closeHHmm) {
    const closeUtc = istHhmmForDate(slotDayYmd, closeHHmm);
    const lastStartUtc = new Date(closeUtc.getTime() - closeBufferMin * 60000);
    if (start.getTime() > lastStartUtc.getTime()) {
      const lastStartIst = toIst(lastStartUtc);
      const lastStartHhmm = `${String(lastStartIst.getUTCHours()).padStart(2,'0')}:${String(lastStartIst.getUTCMinutes()).padStart(2,'0')}`;
      return {
        ok: false, code: 'after_last_slot',
        message: `The last bookable start today is ${lastStartHhmm} (${closeBufferMin} minutes before closing). Please pick an earlier time.`,
        meta: { closeTime: closeHHmm, closeBufferMin, lastStartIso: lastStartUtc.toISOString() },
      };
    }
  }

  return { ok: true, requiredLeadMin };
}
