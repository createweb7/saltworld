// Salt World — centralized scheduling engine.
//
// One module. One source of truth. Consumed by:
//   • customer site         (booking flow)
//   • customer portal       (rescheduling)
//   • reception             (walk-in booking)
//   • admin booking module  (calendar + creation)
//   • public API            (partners)
//
// Concepts
// --------
// A Journey = ordered list of therapies chosen by the customer.
// A Plan    = per-therapy sub-window computed from a candidate startAt:
//   For therapy i in sequence:
//     from_i = end_{i-1} + max(postBuffer_{i-1} + preBuffer_i, cleaningBuffer_{i-1})
//     to_i   = from_i + durationMin_i
//     (start of first therapy = candidate startAt + preBuffer_0)
//   Total visit = end_last + cleaningBuffer_last.
//
// Availability
// ------------
// For every candidate start in a 15-min grid (configurable per branch) across
// working hours, we verify each therapy has at least one resource free during
// its sub-window (matching branch, respecting existing bookings + maintenance).
// Only start times where the ENTIRE journey fits are returned.

import { getDb } from '@/lib/mongo';
import { getBranchById, getDefaultBranch } from '@/lib/branches';

// ---------- config ----------

const IST_OFFSET_MIN = 330; // Asia/Kolkata is fixed offset (no DST)
const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '20:00';
const DEFAULT_STEP_MIN = 15;

async function loadSchedulingConfig(branchId) {
  const db = await getDb();
  const doc = await db.collection('settings').findOne({ key: 'scheduling' });
  const global = doc?.value || {};
  const branch = branchId ? await getBranchById(branchId) : await getDefaultBranch();
  const branchHours = branch?.hours || null;
  return {
    openTime:      global.openTime  || DEFAULT_OPEN,
    closeTime:     global.closeTime || DEFAULT_CLOSE,
    slotStepMin:   Number(global.slotStepMin) || DEFAULT_STEP_MIN,
    holidays:      Array.isArray(global.holidays) ? global.holidays : [],
    maintenance:   Array.isArray(global.maintenance) ? global.maintenance : [],
    branchHours,   // per-branch weekday hours override
    timezoneOffset: IST_OFFSET_MIN,
  };
}

// Convert 'HH:mm' on a local date to a UTC Date treating the local as IST (+05:30).
function localOnDayToUtc(dateIso /* YYYY-MM-DD */, hhmm /* HH:mm */) {
  const [h, m] = hhmm.split(':').map(Number);
  // Local IST = UTC + 05:30. So UTC = local - 05:30.
  // Build a UTC Date pretending the local wall clock is UTC then subtract offset.
  const utc = new Date(`${dateIso}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);
  utc.setUTCMinutes(utc.getUTCMinutes() - IST_OFFSET_MIN);
  return utc;
}

function utcToLocalHHmm(utc) {
  const shifted = new Date(utc.getTime() + IST_OFFSET_MIN * 60000);
  return `${String(shifted.getUTCHours()).padStart(2,'0')}:${String(shifted.getUTCMinutes()).padStart(2,'0')}`;
}

function weekdayKey(utc) {
  const shifted = new Date(utc.getTime() + IST_OFFSET_MIN * 60000);
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][shifted.getUTCDay()];
}

// ---------- journey plan ----------

/**
 * Build a plan from a candidate start Date and an ordered list of therapy docs.
 * Returns { plan: [{therapySlug, name, from, to, durationMin}], visitFrom, visitTo, totalDurationMin, totalVisitMin }.
 */
export function buildJourneyPlan(candidateStartUtc, therapies) {
  if (!Array.isArray(therapies) || therapies.length === 0) return null;
  const plan = [];
  let visitStart = null;
  let cursor = candidateStartUtc.getTime();
  let prevPost = 0;
  let prevClean = 0;
  let firstPre = 0;
  let totalDuration = 0;

  therapies.forEach((t, i) => {
    const pre  = Number(t.preBufferMin      || 0);
    const post = Number(t.postBufferMin     || 0);
    const clean= Number(t.cleaningBufferMin || 0);
    const dur  = Number(t.durationMin       || 60);
    let therapyFromMs;
    if (i === 0) {
      firstPre = pre;
      // visitStart = candidate - pre (customer arrives 'pre' minutes early)
      // therapyFrom = candidate itself (start of session as seen by customer)
      therapyFromMs = cursor;
      visitStart = new Date(cursor - pre * 60000);
    } else {
      const gap = Math.max(prevPost + pre, prevClean);
      therapyFromMs = cursor + gap * 60000;
    }
    const therapyToMs = therapyFromMs + dur * 60000;
    plan.push({
      therapySlug: t.slug,
      name: t.name,
      from: new Date(therapyFromMs).toISOString(),
      to:   new Date(therapyToMs).toISOString(),
      durationMin: dur,
      preBufferMin: pre,
      postBufferMin: post,
      cleaningBufferMin: clean,
    });
    totalDuration += dur;
    cursor = therapyToMs;
    prevPost  = post;
    prevClean = clean;
  });

  const visitEnd = new Date(cursor + prevClean * 60000);
  const totalVisitMin = Math.round((visitEnd.getTime() - visitStart.getTime()) / 60000);
  return {
    plan,
    visitFrom: visitStart.toISOString(),
    visitTo:   visitEnd.toISOString(),
    totalDurationMin: totalDuration,
    totalVisitMin,
  };
}

// ---------- availability ----------

async function loadTherapies(db, slugs) {
  const docs = await db.collection('therapies').find({ slug: { $in: slugs } }).toArray();
  const bySlug = new Map(docs.map((d) => [d.slug, d]));
  // Preserve caller order.
  return slugs.map((s) => bySlug.get(s)).filter(Boolean);
}

// For a plan, verify each therapy has at least one free resource in its sub-window.
// Returns { ok:boolean, assignments?:[{therapySlug, resourceId, resourceName}] }
export async function checkJourneyAvailability({ plan, therapies, branchId, excludeBookingId = null, sessionMode = null }) {
  const db = await getDb();
  const { findConflictingBlock } = await import('@/lib/calendar-blocks');
  const assignments = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const therapy = therapies[i];
    if (!therapy) return { ok: false };
    const rQuery = {
      id: { $in: therapy.resourceIds || [] },
      active: { $ne: false },
    };
    if (branchId) rQuery.branchId = branchId;
    let candidates = await db.collection('resources').find(rQuery).toArray();
    if (candidates.length === 0) return { ok: false, reason: `no_resources_for_${step.therapySlug}` };

    // Float-tank session-mode filter. Tanks may support ['single'], ['couple'],
    // or both. If sessionMode is passed for a float therapy step, filter here.
    const isFloat = String(step.therapySlug || '').includes('float');
    if (isFloat && sessionMode && (sessionMode === 'single' || sessionMode === 'couple')) {
      candidates = candidates.filter((r) => {
        const modes = Array.isArray(r.supportedModes) && r.supportedModes.length > 0
          ? r.supportedModes
          : ['single', 'couple']; // default: both
        return modes.includes(sessionMode);
      });
      if (candidates.length === 0) return { ok: false, reason: `no_${sessionMode}_float_tank` };
    }

    // Window this step blocks — include the pre-buffer for the first and cleaning after last.
    const stepBlockFromMs = new Date(step.from).getTime() - Number(step.preBufferMin || 0) * 60000;
    const stepBlockToMs   = new Date(step.to).getTime()   + Number(step.postBufferMin || 0) * 60000 + Number(step.cleaningBufferMin || 0) * 60000;
    const stepBlockFrom = new Date(stepBlockFromMs).toISOString();
    const stepBlockTo   = new Date(stepBlockToMs).toISOString();

    let chosen = null;
    let firstBlockReason = null;
    for (const r of candidates) {
      // Calendar block check per candidate — uses the resource's ACTUAL branch
      // (not the query branchId, which may be null when the customer hasn't
      // picked a branch yet). This ensures branch-wide blocks bite correctly.
      const blockedByCalendar = await findConflictingBlock({
        fromIso: stepBlockFrom,
        toIso:   stepBlockTo,
        branchId: r.branchId || branchId || null,
        therapySlug: step.therapySlug,
        resourceId: r.id,
      });
      if (blockedByCalendar) {
        if (!firstBlockReason) firstBlockReason = `calendar_block_${blockedByCalendar.scope}_${blockedByCalendar.reason}`;
        continue;
      }

      // Overlap iff booking.blockedFrom < stepBlockTo AND booking.blockedTo > stepBlockFrom.
      const overlap = await db.collection('bookings').findOne({
        status: { $nin: ['cancelled', 'no_show'] },
        ...(excludeBookingId ? { id: { $ne: excludeBookingId } } : {}),
        $or: [
          // legacy single-resource bookings
          { resourceId: r.id, blockedFrom: { $lt: stepBlockTo }, blockedTo: { $gt: stepBlockFrom } },
          // journey bookings that assigned this resource for one of their steps
          { schedule: { $elemMatch: { resourceId: r.id, from: { $lt: stepBlockTo }, to: { $gt: stepBlockFrom } } } },
        ],
      });
      if (overlap) continue;

      // Maintenance block?
      const maint = await db.collection('maintenance_blocks').findOne({
        resourceId: r.id,
        from: { $lt: stepBlockTo },
        to:   { $gt: stepBlockFrom },
      });
      if (maint) continue;

      chosen = r; break;
    }
    if (!chosen) return { ok: false, reason: firstBlockReason || `no_free_resource_for_${step.therapySlug}_at_${step.from}` };
    assignments.push({ therapySlug: step.therapySlug, resourceId: chosen.id, resourceName: chosen.name, from: step.from, to: step.to });
  }
  return { ok: true, assignments };
}

/**
 * Public: return grouped available start times for a journey on a date.
 *
 * @param therapySlugs  ordered array of therapy slugs
 * @param branchId
 * @param dateIso       'YYYY-MM-DD'
 * @returns { totalDurationMin, totalVisitMin, groups: {morning:[], afternoon:[], evening:[]} }
 *          each slot: { time:'HH:mm', startIso, visitFromIso, visitToIso }
 */
export async function availableJourneySlots({ therapySlugs, branchId, dateIso, sessionMode = null }) {
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) return null;
  const db = await getDb();
  const therapies = await loadTherapies(db, therapySlugs);
  if (therapies.length === 0) return null;

  const cfg = await loadSchedulingConfig(branchId);

  // Branch closed on holiday?
  if (cfg.holidays.includes(dateIso)) {
    return { totalDurationMin: 0, totalVisitMin: 0, groups: { morning: [], afternoon: [], evening: [] }, closed: true, reason: 'branch_holiday' };
  }

  // Branch hours for this weekday (fall back to global open/close).
  const weekOpenClose = (() => {
    const wk = weekdayKey(new Date(dateIso + 'T12:00:00Z'));
    const bh = cfg.branchHours?.[wk];
    if (bh && bh.open === false) return null; // closed
    return {
      open:  (bh && bh.from) || cfg.openTime,
      close: (bh && bh.to)   || cfg.closeTime,
    };
  })();

  if (!weekOpenClose) {
    return { totalDurationMin: 0, totalVisitMin: 0, groups: { morning: [], afternoon: [], evening: [] }, closed: true, reason: 'branch_closed_weekday' };
  }

  const openUtc  = localOnDayToUtc(dateIso, weekOpenClose.open);
  const closeUtc = localOnDayToUtc(dateIso, weekOpenClose.close);
  // Minimum lead time — never show slots less than this many minutes in the
  // future. Keeps customers from selecting a slot that's already passed.
  const MIN_LEAD_MIN = 15;
  const earliestUtc  = Date.now() + MIN_LEAD_MIN * 60000;

  const groups = { morning: [], afternoon: [], evening: [] };
  let totalDurationMin = 0;
  let totalVisitMin = 0;

  for (let ms = openUtc.getTime(); ms <= closeUtc.getTime() - 15 * 60000; ms += cfg.slotStepMin * 60000) {
    if (ms < earliestUtc) continue;
    const candidate = new Date(ms);
    const journey = buildJourneyPlan(candidate, therapies);
    if (!journey) continue;
    totalDurationMin = journey.totalDurationMin;
    totalVisitMin = journey.totalVisitMin;

    // Journey must fit inside branch hours.
    if (new Date(journey.visitTo).getTime() > closeUtc.getTime()) continue;

    const check = await checkJourneyAvailability({ plan: journey.plan, therapies, branchId, sessionMode });
    if (!check.ok) continue;

    const hhmm = utcToLocalHHmm(candidate);
    const hour = parseInt(hhmm.slice(0, 2), 10);
    const slot = {
      time: hhmm,
      startIso: candidate.toISOString(),
      visitFromIso: journey.visitFrom,
      visitToIso: journey.visitTo,
      // Per-therapy sub-schedule (used by the UI to render the itinerary)
      plan: journey.plan.map((p) => ({
        therapySlug: p.therapySlug,
        name: p.name,
        from: p.from,
        to: p.to,
        durationMin: p.durationMin,
      })),
    };
    if (hour < 12)      groups.morning.push(slot);
    else if (hour < 17) groups.afternoon.push(slot);
    else                groups.evening.push(slot);
  }

  return { totalDurationMin, totalVisitMin, groups, closed: false };
}

// ---------- concierge recommender (preferred-time based) ----------

/**
 * Given a customer's preferred start time on a specific date, return the top
 * N intelligently-ranked complete wellness journeys.
 *
 * Search window: ±60 minutes around the preferred time on a 15-min grid.
 * Each candidate is fully validated for resource availability + calendar
 * blocks + branch hours before scoring.
 *
 * Scoring (lower is better):
 *   composite   = |candidate - preferred| + 0.5 × totalVisitMin
 *   fastestKey  = visitTo (earliest finish wins)
 *   leastWait   = internal waiting + |candidate - preferred|
 *
 * Returns up to `limit` distinct schedules with badges assigned:
 *   - "best_match"      → closest to preferred time
 *   - "fastest_finish"  → earliest completion time
 *   - "least_waiting"   → shortest gap+delta combo
 *
 * When the same schedule wins multiple criteria, badges collapse (only
 * strongest one shown). Additional candidates are added to reach `limit`
 * by taking the next best "best_match" that hasn't been picked.
 *
 * If `startOffset > 0`, skip the top `startOffset` composite winners so
 * "Show More Recommendations" can page through additional schedules.
 */
export async function recommendJourneys({
  therapySlugs, branchId, dateIso, preferredTime,
  windowMin = 60,
  sessionMode = null,
  limit = 3,
  startOffset = 0,
}) {
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) {
    return { recommendations: [], reason: 'no_therapies' };
  }
  if (!dateIso || !preferredTime) {
    return { recommendations: [], reason: 'missing_input' };
  }
  const db = await getDb();
  const therapies = await loadTherapies(db, therapySlugs);
  if (therapies.length === 0) return { recommendations: [], reason: 'therapies_not_found' };

  const cfg = await loadSchedulingConfig(branchId);
  if (cfg.holidays.includes(dateIso)) {
    return { recommendations: [], closed: true, reason: 'branch_holiday' };
  }
  const wk = weekdayKey(new Date(dateIso + 'T12:00:00Z'));
  const bh = cfg.branchHours?.[wk];
  if (bh && bh.open === false) {
    return { recommendations: [], closed: true, reason: 'branch_closed_weekday' };
  }
  const openTime  = (bh && bh.from) || cfg.openTime;
  const closeTime = (bh && bh.to)   || cfg.closeTime;
  const openUtc   = localOnDayToUtc(dateIso, openTime);
  const closeUtc  = localOnDayToUtc(dateIso, closeTime);
  const preferredUtc = localOnDayToUtc(dateIso, preferredTime);

  const MIN_LEAD_MIN = 15;
  const earliestUtc  = Date.now() + MIN_LEAD_MIN * 60000;

  // Window bounds — clip to branch hours.
  const winFromMs = Math.max(openUtc.getTime(), preferredUtc.getTime() - windowMin * 60000);
  const winToMs   = Math.min(closeUtc.getTime() - 15 * 60000, preferredUtc.getTime() + windowMin * 60000);

  // Scan every 15-min candidate and score feasible plans.
  const feasible = [];
  const step = cfg.slotStepMin || 15;
  for (let ms = winFromMs; ms <= winToMs; ms += step * 60000) {
    if (ms < earliestUtc) continue;
    const candidate = new Date(ms);
    const journey = buildJourneyPlan(candidate, therapies);
    if (!journey) continue;
    if (new Date(journey.visitTo).getTime() > closeUtc.getTime()) continue;
    const check = await checkJourneyAvailability({ plan: journey.plan, therapies, branchId, sessionMode });
    if (!check.ok) continue;

    // Internal waiting time (currently 0 with the back-to-back planner, kept
    // for forward-compat if we introduce non-contiguous scheduling).
    let waitingMin = 0;
    for (let i = 1; i < journey.plan.length; i++) {
      const prevTo = new Date(journey.plan[i - 1].to).getTime();
      const curFrom = new Date(journey.plan[i].from).getTime();
      const gap = Math.max(0, (curFrom - prevTo) / 60000);
      // Subtract required inter-step buffer so "waiting" excludes cleaning.
      const requiredBuffer = Math.max(
        Number(journey.plan[i - 1].postBufferMin || 0) + Number(journey.plan[i].preBufferMin || 0),
        Number(journey.plan[i - 1].cleaningBufferMin || 0),
      );
      waitingMin += Math.max(0, gap - requiredBuffer);
    }

    const deltaFromPreferredMin = Math.abs((candidate.getTime() - preferredUtc.getTime()) / 60000);
    const hhmm = utcToLocalHHmm(candidate);

    feasible.push({
      time: hhmm,
      startIso: candidate.toISOString(),
      visitFromIso: journey.visitFrom,
      visitToIso:   journey.visitTo,
      completionAtIso: journey.visitTo,
      plan: journey.plan.map((p) => ({
        therapySlug: p.therapySlug,
        name: p.name,
        from: p.from,
        to: p.to,
        durationMin: p.durationMin,
      })),
      totalDurationMin: journey.totalDurationMin,
      totalVisitMin:    journey.totalVisitMin,
      waitingMin,
      deltaFromPreferredMin,
      // Composite score = closest to preferred + prefer shorter total visit.
      _score: deltaFromPreferredMin + 0.5 * journey.totalVisitMin,
    });
  }

  if (feasible.length === 0) {
    return { recommendations: [], closed: false, reason: 'no_availability', totalDurationMin: 0, totalVisitMin: 0 };
  }

  // Rankings.
  const byBest    = [...feasible].sort((a, b) => a._score - b._score);
  const byFastest = [...feasible].sort((a, b) =>
    new Date(a.completionAtIso).getTime() - new Date(b.completionAtIso).getTime(),
  );
  const byWait    = [...feasible].sort((a, b) => {
    const wa = a.waitingMin + a.deltaFromPreferredMin * 0.5;
    const wb = b.waitingMin + b.deltaFromPreferredMin * 0.5;
    return wa - wb;
  });

  // Build ONE deterministic global ordering, then slice by offset. Every page
  // uses the same base list, so "Show More Recommendations" never surfaces a
  // schedule the customer has already seen on an earlier page.
  const globalPicks = [];
  const globalSeen = new Set();
  const pushPick = (candidate, badge, badgeLabel) => {
    if (!candidate || globalSeen.has(candidate.startIso)) return;
    globalSeen.add(candidate.startIso);
    const { _score, ...cleanCand } = candidate;
    globalPicks.push({ ...cleanCand, badge, badgeLabel });
  };
  let bi = 0, fi = 0, wi = 0;
  const target = startOffset + limit;
  while (globalPicks.length < target) {
    const before = globalPicks.length;
    while (bi < byBest.length    && globalSeen.has(byBest[bi].startIso))    bi++;
    if (bi < byBest.length)    pushPick(byBest[bi++],    'best_match',     'Best Match');
    if (globalPicks.length >= target) break;
    while (fi < byFastest.length && globalSeen.has(byFastest[fi].startIso)) fi++;
    if (fi < byFastest.length) pushPick(byFastest[fi++], 'fastest_finish', 'Fastest Finish');
    if (globalPicks.length >= target) break;
    while (wi < byWait.length    && globalSeen.has(byWait[wi].startIso))    wi++;
    if (wi < byWait.length)    pushPick(byWait[wi++],    'least_waiting',  'Least Waiting');
    if (globalPicks.length === before) break; // no progress possible
  }
  const picks = globalPicks.slice(startOffset, startOffset + limit);

  return {
    totalDurationMin: feasible[0].totalDurationMin,
    totalVisitMin:    feasible[0].totalVisitMin,
    recommendations:  picks.slice(0, limit),
    availableCount:   feasible.length,
    reason:           null,
  };
}

// ---------- allocation for POST /api/bookings (uses the same engine) ----------

/**
 * Called at booking creation. Resolves therapies from slugs, builds the plan
 * for the requested startIso, verifies availability + returns full schedule
 * with per-therapy resource assignments.
 *
 * @returns { ok, journey, schedule, resourceId (primary), resourceName (primary), blockedFrom, blockedTo, reason? }
 */
export async function allocateJourney({ therapySlugs, branchId, startIso, excludeBookingId = null, sessionMode = null }) {
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) return { ok: false, reason: 'no_therapies' };
  const db = await getDb();
  const therapies = await loadTherapies(db, therapySlugs);
  if (therapies.length === 0) return { ok: false, reason: 'therapies_not_found' };
  const journey = buildJourneyPlan(new Date(startIso), therapies);
  if (!journey) return { ok: false, reason: 'plan_failed' };
  const check = await checkJourneyAvailability({ plan: journey.plan, therapies, branchId, excludeBookingId, sessionMode });
  if (!check.ok) return { ok: false, reason: check.reason || 'unavailable' };
  const schedule = check.assignments;
  return {
    ok: true,
    journey,
    schedule,
    // Primary (first) therapy assignment surfaced for the top-level booking fields
    resourceId:   schedule[0]?.resourceId,
    resourceName: schedule[0]?.resourceName,
    blockedFrom:  journey.visitFrom,
    blockedTo:    journey.visitTo,
  };
}

/**
 * Given a failed booking attempt (or any therapy set), return up to N next
 * available start times on the same day (after the requested time) plus a
 * handful from the following day. Used to guide customers when their chosen
 * slot got taken during checkout.
 */
export async function suggestNextAvailableSlots({ therapySlugs, branchId, startIso, sessionMode = null, limit = 5 }) {
  const suggestions = [];
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) return suggestions;
  const start = new Date(startIso);
  const istOffset = 330 * 60000;
  const localMs = start.getTime() + istOffset;
  const localDay = new Date(localMs).toISOString().slice(0, 10);
  const localTime = new Date(localMs).toISOString().slice(11, 16);

  // Same day, times strictly after the failed one.
  const today = await availableJourneySlots({ therapySlugs, branchId, dateIso: localDay, sessionMode });
  if (today && !today.closed) {
    const all = [...(today.groups?.morning || []), ...(today.groups?.afternoon || []), ...(today.groups?.evening || [])];
    for (const s of all) {
      if (s.time > localTime) suggestions.push({ ...s, date: localDay });
      if (suggestions.length >= limit) break;
    }
  }

  // Overflow: look up to 3 more days.
  if (suggestions.length < limit) {
    for (let d = 1; d <= 3 && suggestions.length < limit; d++) {
      const nextDay = new Date(new Date(localDay).getTime() + d * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const r = await availableJourneySlots({ therapySlugs, branchId, dateIso: nextDay, sessionMode });
      if (!r || r.closed) continue;
      const all = [...(r.groups?.morning || []), ...(r.groups?.afternoon || []), ...(r.groups?.evening || [])];
      for (const s of all) {
        suggestions.push({ ...s, date: nextDay });
        if (suggestions.length >= limit) break;
      }
    }
  }
  return suggestions;
}

// ---------- legacy helpers (kept for callers still using them) ----------

/** @deprecated — use allocateJourney. Kept for backwards compat. */
export async function allocateResource({ therapySlug, branchId, startIso, excludeBookingId = null }) {
  const r = await allocateJourney({ therapySlugs: [therapySlug], branchId, startIso, excludeBookingId });
  if (!r.ok) return null;
  return { resourceId: r.resourceId, resourceName: r.resourceName, blockedFrom: r.blockedFrom, blockedTo: r.blockedTo };
}

/** @deprecated — use availableJourneySlots. */
export async function daySlots({ therapySlug, branchId, dateIso }) {
  const r = await availableJourneySlots({ therapySlugs: [therapySlug], branchId, dateIso });
  if (!r) return [];
  return [...r.groups.morning, ...r.groups.afternoon, ...r.groups.evening];
}
