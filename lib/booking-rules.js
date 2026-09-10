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
// 3. sameDayLateCutoff — after `sameDayCutoffHourIst` on day X, slots at or
//    after `sameDayLastBookableHourIst` on day X become unbookable, for ALL
//    therapies. Default: after 19:00 no ≥20:00 slot.
//
// 4. lastBookableSlot — per-therapy latest customer-facing start time,
//    independent of branch closing time.
//
// 5. cancelReschedule — legacy customer-mutation cutoff (kept as-is).
//
// All rules are settings-driven; no hardcoding in the engine's callers.

import { getSupabase } from '@/lib/supabase';

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

// Last bookable START time per therapy (product spec — Rules for Booking doc).
// Business hours (branch.hours) govern when staff can be on-site for cleanup;
// this governs the latest a CUSTOMER can start a given therapy, independent
// of closing time. Float closes earlier (8:30 PM) than the rest (9 PM).
const DEFAULT_PER_THERAPY_LAST_SLOT = {
  'float-therapy':      '20:30',
  'salt-therapy':       '21:00',
  'kids-salt-therapy':  '21:00',
  'red-light-therapy':  '21:00',
  'infrared-sauna':     '21:00',
  'cold-plunge':        '21:00',
  'hot-cold-contrast':  '21:00',
};

const DEFAULT_NEXT_DAY_EARLY_CUTOFF = {
  cutoffHourIst: 21, // "after 9 PM"
  buckets: [
    { slugs: ['salt-therapy', 'red-light-therapy', 'infrared-sauna'],   cutoffTime: '08:30' },
    { slugs: ['float-therapy', 'cold-plunge', 'hot-cold-contrast'],     cutoffTime: '09:00' },
  ],
};

const DEFAULT_SAME_DAY_LATE_CUTOFF = {
  sameDayCutoffHourIst: 19,       // after 7 PM today...
  sameDayLastBookableHourIst: 20, // ...no slot at or after 8 PM today
};

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
    perTherapyLastSlot:      Object.assign({}, DEFAULT_PER_THERAPY_LAST_SLOT, value.perTherapyLastSlot || {}),
    nextDayEarlyCutoff:      value.nextDayEarlyCutoff || DEFAULT_NEXT_DAY_EARLY_CUTOFF,
    sameDayLateCutoff:       value.sameDayLateCutoff  || DEFAULT_SAME_DAY_LATE_CUTOFF,
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
    perTherapyLastSlot:     patch.perTherapyLastSlot     || cur.perTherapyLastSlot,
    nextDayEarlyCutoff:     patch.nextDayEarlyCutoff     || cur.nextDayEarlyCutoff,
    sameDayLateCutoff:      patch.sameDayLateCutoff      || cur.sameDayLateCutoff,
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
function istHour(date) { return toIst(date).getUTCHours(); }

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
export async function assertCanBook({ therapies = [], startIso, nowIso = null, preloadedRules = null } = {}) {
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

  // ---- 2. Same-day late cutoff --------------------------------------------
  // After 19:00 IST today, no slot ≥ 20:00 IST today for ANY therapy.
  const sdc = rules.sameDayLateCutoff || DEFAULT_SAME_DAY_LATE_CUTOFF;
  if (istDayYmd(start) === istDayYmd(now)) {
    if (istHour(now) >= Number(sdc.sameDayCutoffHourIst)
        && istHour(start) >= Number(sdc.sameDayLastBookableHourIst)) {
      return {
        ok: false, code: 'same_day_late_cutoff',
        message: `Sessions from ${String(sdc.sameDayLastBookableHourIst).padStart(2,'0')}:00 onward can't be booked after ${String(sdc.sameDayCutoffHourIst).padStart(2,'0')}:00 on the same day.`,
        meta: sdc,
      };
    }
  }

  // ---- 3. Early-morning cutoff --------------------------------------------
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

  // ---- 4. Last bookable slot (per therapy) ---------------------------------
  // Independent of branch closing time — governs the latest a customer may
  // START this therapy. Take the EARLIEST (strictest) last-slot across the
  // selected therapies, mirroring the lead-time rule above.
  const perLastSlot = rules.perTherapyLastSlot || DEFAULT_PER_THERAPY_LAST_SLOT;
  const startHhmm = (() => {
    const ist = toIst(start);
    return `${String(ist.getUTCHours()).padStart(2,'0')}:${String(ist.getUTCMinutes()).padStart(2,'0')}`;
  })();
  let strictestLastSlot = null;
  for (const slug of therapies) {
    const t = perLastSlot[slug];
    if (!t) continue;
    if (strictestLastSlot === null || t < strictestLastSlot) strictestLastSlot = t;
  }
  if (strictestLastSlot !== null && startHhmm > strictestLastSlot) {
    return {
      ok: false, code: 'after_last_slot',
      message: `The last bookable slot for this therapy is ${strictestLastSlot}. Please pick an earlier time.`,
      meta: { lastSlotTime: strictestLastSlot },
    };
  }

  return { ok: true, requiredLeadMin };
}
