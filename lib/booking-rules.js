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
// 4. cancelReschedule — legacy customer-mutation cutoff (kept as-is).
//
// All rules are settings-driven; no hardcoding in the engine's callers.

import { getDb } from '@/lib/mongo';

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

const DEFAULT_SAME_DAY_LATE_CUTOFF = {
  sameDayCutoffHourIst: 19,       // after 7 PM today...
  sameDayLastBookableHourIst: 20, // ...no slot at or after 8 PM today
};

// -----------------------------------------------------------------------------
// Load / save
// -----------------------------------------------------------------------------
export async function loadBookingRules() {
  const db = await getDb();
  const doc = await db.collection('settings').findOne({ key: 'bookingRules' });
  const value = doc?.value || {};
  return {
    // legacy cancel/reschedule
    cutoffTime:              value.cutoffTime || DEFAULT_CUTOFF_TIME,
    cutoffDaysBefore:        Number(value.cutoffDaysBefore ?? 1),
    minRescheduleNoticeMin:  Number(value.minRescheduleNoticeMin || 0),
    // NEW — booking creation gates
    defaultMinLeadTimeMin:   Number(value.defaultMinLeadTimeMin ?? DEFAULT_MIN_LEAD_MIN),
    perTherapyLeadMin:       Object.assign({}, DEFAULT_PER_THERAPY_LEAD, value.perTherapyLeadMin || {}),
    nextDayEarlyCutoff:      value.nextDayEarlyCutoff || DEFAULT_NEXT_DAY_EARLY_CUTOFF,
    sameDayLateCutoff:       value.sameDayLateCutoff  || DEFAULT_SAME_DAY_LATE_CUTOFF,
  };
}

export async function saveBookingRules(patch, actorId = null) {
  const db = await getDb();
  const now = new Date().toISOString();
  const cur = (await loadBookingRules());
  const next = {
    cutoffTime:             patch.cutoffTime            || cur.cutoffTime,
    cutoffDaysBefore:       Number(patch.cutoffDaysBefore       ?? cur.cutoffDaysBefore),
    minRescheduleNoticeMin: Number(patch.minRescheduleNoticeMin ?? cur.minRescheduleNoticeMin),
    defaultMinLeadTimeMin:  Number(patch.defaultMinLeadTimeMin  ?? cur.defaultMinLeadTimeMin),
    perTherapyLeadMin:      patch.perTherapyLeadMin      || cur.perTherapyLeadMin,
    nextDayEarlyCutoff:     patch.nextDayEarlyCutoff     || cur.nextDayEarlyCutoff,
    sameDayLateCutoff:      patch.sameDayLateCutoff      || cur.sameDayLateCutoff,
  };
  await db.collection('settings').updateOne(
    { key: 'bookingRules' },
    { $set: { key: 'bookingRules', value: next, updatedAt: now, updatedBy: actorId }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
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
// MAIN — assertCanBook: unified check for CREATE-booking eligibility.
//
// therapies:  ['float-therapy', 'salt-therapy']  (ordered slugs)
// startIso:   ISO string of first therapy start (or visit-from — the check
//             uses startIso as the earliest touched moment).
// nowIso?:    optional override for testing.
//
// Returns { ok:true } or { ok:false, code, message, meta }.
// -----------------------------------------------------------------------------
export async function assertCanBook({ therapies = [], startIso, nowIso = null } = {}) {
  if (!Array.isArray(therapies) || therapies.length === 0) {
    return { ok: false, code: 'no_therapies', message: 'Select at least one therapy.' };
  }
  if (!startIso) {
    return { ok: false, code: 'no_start', message: 'Pick a start time.' };
  }
  const rules   = await loadBookingRules();
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

  // ---- 3. Next-day early cutoff -------------------------------------------
  // After `cutoffHourIst` on day X, day X+1 slots ≤ each bucket's cutoffTime
  // become unbookable for that bucket's slugs.
  const ndc = rules.nextDayEarlyCutoff || DEFAULT_NEXT_DAY_EARLY_CUTOFF;
  // Only applies to a start on the NEXT calendar day (in IST).
  const nowIst   = toIst(now);
  const nextDayIst = new Date(nowIst.getTime()); nextDayIst.setUTCDate(nowIst.getUTCDate() + 1);
  const nextDayYmd = `${nextDayIst.getUTCFullYear()}-${String(nextDayIst.getUTCMonth()+1).padStart(2,'0')}-${String(nextDayIst.getUTCDate()).padStart(2,'0')}`;
  if (istHour(now) >= Number(ndc.cutoffHourIst) && istDayYmd(start) === nextDayYmd) {
    for (const bucket of ndc.buckets || []) {
      const bucketSlugs = new Set(bucket.slugs || []);
      const relevant = therapies.some((s) => bucketSlugs.has(s));
      if (!relevant) continue;
      const bucketCutoffUtc = istHhmmForDate(nextDayYmd, bucket.cutoffTime);
      if (start.getTime() <= bucketCutoffUtc.getTime()) {
        return {
          ok: false, code: 'next_day_early_cutoff',
          message: `Bookings at ${bucket.cutoffTime} or earlier can't be made after ${String(ndc.cutoffHourIst).padStart(2,'0')}:00 the previous night. Pick a later time or a different day.`,
          meta: { bucket, cutoffHourIst: ndc.cutoffHourIst, nextDayYmd },
        };
      }
    }
  }

  return { ok: true, requiredLeadMin };
}
