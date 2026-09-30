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
//
// Resource-conflict checking reads from `booking_schedule_items` (one row
// per therapy-step per booking, with its own resource_id/starts_at/ends_at)
// rather than scanning an embedded array — every booking, old and new
// shape, has rows there (see scripts/supabase/migrate-data.mjs).

import { getSupabase } from '@/lib/supabase';
import { getBranchById, getDefaultBranch } from '@/lib/branches';
import { toTherapy } from '@/lib/db-mappers';

// ---------- config ----------

const IST_OFFSET_MIN = 330; // Asia/Kolkata is fixed offset (no DST)
const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '20:00';
const DEFAULT_STEP_MIN = 15;

// Float tank sessions run only at these fixed times each day — fixed, not
// availability-computed — so tank turnover/cleaning stays predictable for
// staff (our main service). Other therapies in the same journey are still
// scheduled dynamically, fit in before/after whichever anchor the guest picks.
const FLOAT_ANCHOR_TIMES = ['08:00', '10:30', '13:00', '15:30', '18:00', '20:30'];

function isFloatSlug(slug) {
  return String(slug || '').includes('float');
}

// Round a UTC ms timestamp forward to the next Float anchor time (same local
// calendar day). Returns null if there's no anchor left that day (past 20:30
// IST) — the plan is then infeasible, same as running out of business hours.
function snapToNextFloatAnchor(ms) {
  const shifted = new Date(ms + IST_OFFSET_MIN * 60000);
  const hhmm = `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
  const anchor = FLOAT_ANCHOR_TIMES.find((a) => a >= hhmm);
  if (!anchor) return null;
  if (anchor === hhmm) return ms;
  const dateIsoLocal = shifted.toISOString().slice(0, 10);
  return localOnDayToUtc(dateIsoLocal, anchor).getTime();
}

async function loadSchedulingConfig(branchId) {
  const supabase = getSupabase();
  const [{ data: row }, branch] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'scheduling').maybeSingle(),
    branchId ? getBranchById(branchId) : getDefaultBranch(),
  ]);
  const global = row?.value || {};
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
export function buildJourneyPlan(candidateStartUtc, therapies, { durationOverrides = null, guests = 1, children = 0, delays = null } = {}) {
  if (!Array.isArray(therapies) || therapies.length === 0) return null;
  const plan = [];
  let visitStart = null;
  let cursor = candidateStartUtc.getTime();
  let prevPost = 0;
  let prevClean = 0;
  let firstPre = 0;
  let totalDuration = 0;
  let infeasible = false;

  for (let i = 0; i < therapies.length; i++) {
    const t = therapies[i];
    const pre  = Number(t.preBufferMin      || 0);
    const post = Number(t.postBufferMin     || 0);
    const clean= Number(t.cleaningBufferMin || 0);
    // A per-booking duration override (e.g. Float Tank's 60/90-min choice)
    // takes precedence over the therapy's default durationMin.
    const overrideDur = durationOverrides && Number(durationOverrides[t.slug]);
    const dur  = overrideDur > 0 ? overrideDur : Number(t.durationMin || 60);
    let therapyFromMs;
    if (i === 0) {
      firstPre = pre;
      // visitStart = candidate - pre (customer arrives 'pre' minutes early)
      // therapyFrom = candidate itself (start of session as seen by customer)
      therapyFromMs = cursor;
    } else {
      // The guest only waits for the changeover between rooms (post + pre
      // buffer, or up to 30 min of reset). Full room cleaning time is still
      // held on the room itself via the resource block window, it just
      // doesn't leave the guest sitting idle.
      const gap = Math.max(prevPost + pre, Math.min(prevClean, 30));
      // `delays[i]` = extra minutes the guest waits before step i because that
      // room isn't free right away.
      therapyFromMs = cursor + (gap + Math.max(0, Number(delays?.[i]) || 0)) * 60000;
    }
    // Float never gets an availability-computed start — it only ever runs at
    // a fixed daily time (FLOAT_ANCHOR_TIMES), wherever it falls in the
    // guest's chosen order, so tank turnover stays predictable for staff.
    // Whatever comes before/after it in the journey keeps its own natural,
    // dynamically-computed timing.
    if (isFloatSlug(t.slug)) {
      const snapped = snapToNextFloatAnchor(therapyFromMs);
      if (snapped == null) { infeasible = true; break; }
      therapyFromMs = snapped;
    }
    if (i === 0) visitStart = new Date(therapyFromMs - pre * 60000);
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
      guests: Math.max(1, Number(guests) || 1),
      children: Math.max(0, Math.min(3, Number(children) || 0)),
    });
    totalDuration += dur;
    cursor = therapyToMs;
    prevPost  = post;
    prevClean = clean;
  }
  if (infeasible) return null;

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

// ---------- journey ordering ----------

// Every ordering of the therapies (identity order first, so ties keep the
// customer's own sequence). Capped for large journeys: 5+ therapies only try
// the given order and its reverse.
function therapyOrderings(therapies) {
  const n = therapies.length;
  if (n <= 1) return [therapies];
  if (n > 4) {
    // Full permutation search is too expensive above 4 legs (120+ orders).
    // If Float is among them, what actually matters is WHERE it sits: its
    // own start always snaps forward to the next fixed daily anchor (see
    // buildJourneyPlan), so its position determines how much natural drift
    // has piled up before it, and therefore which anchor it lands on — e.g.
    // Float placed straight after 2 short legs may land on the very next
    // anchor, while the same Float placed last may drift 2+ anchors out.
    // Try every position for Float within the guest's own relative order of
    // the rest, so the ranking can find whichever slot keeps Float closest.
    const floatIdx = therapies.findIndex((t) => isFloatSlug(t.slug));
    if (floatIdx >= 0) {
      const floatT = therapies[floatIdx];
      const rest = therapies.filter((t) => !isFloatSlug(t.slug));
      const out = [];
      for (let i = 0; i <= rest.length; i++) {
        out.push([...rest.slice(0, i), floatT, ...rest.slice(i)]);
      }
      return out;
    }
    return [therapies, [...therapies].reverse()];
  }
  const out = [];
  const rec = (rest, acc) => {
    if (!rest.length) { out.push(acc); return; }
    rest.forEach((t, i) => rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, t]));
  };
  rec(therapies, []);
  return out;
}

// Minutes of unusable idle room-time this plan would leave next to existing
// bookings (gap before + after each step on its assigned resource, looking
// 3h either side). 0 = flush against neighbours or nothing nearby. Shared
// rooms (capacity > 1) are skipped — joining a running group is ideal.
function fragmentationMin(plan, assignments, context) {
  const HORIZON = 180 * 60000;
  let total = 0;
  for (const a of assignments || []) {
    const res = context.resourcesById.get(a.resourceId);
    if (!res || (Number(res.capacity) || 1) > 1) continue;
    const step = plan.find((p) => p.therapySlug === a.therapySlug);
    if (!step) continue;
    const from = new Date(step.from).getTime() - Number(step.preBufferMin || 0) * 60000;
    const to = new Date(step.to).getTime() + (Number(step.postBufferMin || 0) + Number(step.cleaningBufferMin || 0)) * 60000;
    for (const it of context.scheduleByResource.get(a.resourceId) || []) {
      const itStart = new Date(it.startsAt).getTime();
      const itEnd = new Date(it.endsAt).getTime() + (it.bufferMin || 0) * 60000;
      if (itEnd <= from && from - itEnd < HORIZON) total = Math.max(total, 0) + (from - itEnd) / 60000;
      else if (itStart >= to && itStart - to < HORIZON) total += (itStart - to) / 60000;
    }
  }
  return Math.round(total);
}

// For one candidate start time, find the best ORDER of the journey that is
// actually bookable: try every sequence, keep the feasible one with the
// shortest total visit (ties → the customer's own order). Returns
// { journey, therapies, check } or null.
//
// Booking-rules (lead time, next-day cutoff, close buffer) are checked PER
// STEP against that step's own therapy and its own actual computed time —
// not once against the candidate using the worst-case rule across the whole
// set. A journey's lead time is only as strict as whichever therapy is
// actually starting at that moment; gating the candidate itself by (e.g.)
// Float's 90-min lead would wrongly rule out an order where Float isn't
// first and doesn't need to start for a while yet.
async function feasibleJourneysForStart({ candidate, therapies, closeUtc, branchId, sessionMode, context, durationOverrides, guests, children, preloadedRules = null, closeTimeHHmm = null }) {
  const { assertCanBook } = await import('@/lib/booking-rules');
  const out = [];
  const MAX_WAIT_MIN = 60; // longest the guest will idle before any one therapy
  const STEP_MIN = 15;
  for (const order of therapyOrderings(therapies)) {
    // Build the journey greedily: each therapy starts as early as its room is
    // free AND its own rules are satisfied, waiting up to MAX_WAIT_MIN after
    // the previous one. This lets a guest start at their preferred time (e.g.
    // join the Salt Cave at 08:00) and slot the other therapies into
    // whatever gaps the day has.
    const delays = new Array(order.length).fill(0);
    let feasible = true;
    for (let i = 0; i < order.length && feasible; i++) {
      let placed = false;
      for (let d = 0; d <= (i === 0 ? 0 : MAX_WAIT_MIN); d += STEP_MIN) {
        delays[i] = d;
        const partial = buildJourneyPlan(candidate, order.slice(0, i + 1), { durationOverrides, guests, children, delays });
        if (!partial) break;
        const step = partial.plan[i];
        const rulesCheck = await assertCanBook({ therapies: [step.therapySlug], startIso: step.from, preloadedRules, branchId, closeTimeHHmm });
        if (!rulesCheck.ok) continue;
        const stepCheck = await checkJourneyAvailability({ plan: [step], therapies: [order[i]], branchId, sessionMode, context });
        if (stepCheck.ok) { placed = true; break; }
      }
      if (!placed) feasible = false;
    }
    if (!feasible) continue;
    const journey = buildJourneyPlan(candidate, order, { durationOverrides, guests, children, delays });
    if (!journey) continue;
    if (new Date(journey.visitTo).getTime() > closeUtc.getTime()) continue;
    const check = await checkJourneyAvailability({ plan: journey.plan, therapies: order, branchId, sessionMode, context });
    if (!check.ok) continue;
    out.push({ journey, therapies: order, check, fragMin: fragmentationMin(journey.plan, check.assignments, context) });
  }
  // Shortest visit first; then least stranded room-time; then the guest's own
  // order (orderings are generated identity-first and sort is stable).
  out.sort((x, y) => (x.journey.totalVisitMin - y.journey.totalVisitMin) || (x.fragMin - y.fragMin));
  return out;
}

async function bestJourneyForStart(args) {
  return (await feasibleJourneysForStart(args))[0] || null;
}

// ---------- availability ----------

async function loadTherapies(supabase, slugs) {
  const { data: rows } = await supabase.from('therapies').select('*, therapy_resources(resource_id)').in('slug', slugs);
  const bySlug = new Map((rows || []).map((r) => {
    const t = toTherapy(r);
    t.resourceIds = (r.therapy_resources || []).map((tr) => tr.resource_id);
    return [t.slug, t];
  }));
  // Preserve caller order.
  return slugs.map((s) => bySlug.get(s)).filter(Boolean);
}

// Bulk-loads everything checkJourneyAvailability needs to evaluate MANY
// candidate slots against, in a handful of queries instead of one per
// (slot × step × resource) combination. Callers that scan a whole day
// (availableJourneySlots, recommendJourneys) build this ONCE and reuse it;
// a single allocateJourney call builds a narrow one just for its own window.
export async function loadAvailabilityContext({ resourceIds, branchId, fromIso, toIso, excludeBookingId = null }) {
  const supabase = getSupabase();
  const { listBlocksOverlapping } = await import('@/lib/calendar-blocks');
  const ids = [...new Set(resourceIds)];
  const [blocks, scheduleRes, maintRes, resourceRows] = await Promise.all([
    listBlocksOverlapping({ fromIso, toIso }),
    ids.length
      ? supabase.from('booking_schedule_items')
          .select('resource_id, therapy_slug, starts_at, ends_at, booking_id, bookings!inner(guests, status, data)')
          .in('resource_id', ids).lt('starts_at', toIso).gt('ends_at', new Date(new Date(fromIso).getTime() - 3 * 3600000).toISOString())
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('maintenance_blocks').select('resource_id, starts_at, ends_at').in('resource_id', ids).lt('starts_at', toIso).gt('ends_at', fromIso)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('resources').select('*').in('id', ids).not('active', 'is', false)
      : Promise.resolve({ data: [] }),
  ]);
  const resourcesById = new Map((resourceRows.data || []).map((r) => [r.id, {
    id: r.id, name: r.name, type: r.type, capacity: r.capacity,
    supportedModes: r.supported_modes || [], branchId: r.branch_id, active: r.active,
  }]));
  // Existing bookings occupy their resource for the therapy PLUS its post +
  // cleaning buffer, exactly like a candidate does for itself. Without this
  // a new visit could start the instant a previous one ended, skipping the
  // turnover time the earlier booking requires.
  const slugs = [...new Set((scheduleRes.data || []).map((r) => r.therapy_slug).filter(Boolean))];
  const bufferBySlug = new Map();
  if (slugs.length) {
    const { data: bufRows } = await supabase.from('therapies').select('slug, post_buffer_min, cleaning_buffer_min').in('slug', slugs);
    for (const t of bufRows || []) {
      bufferBySlug.set(t.slug, (Number(t.post_buffer_min) || 0) + (Number(t.cleaning_buffer_min) || 0));
    }
  }
  const scheduleByResource = new Map();
  for (const row of scheduleRes.data || []) {
    if (excludeBookingId && row.booking_id === excludeBookingId) continue;
    if (['cancelled', 'no_show'].includes(row.bookings?.status)) continue;
    const arr = scheduleByResource.get(row.resource_id) || [];
    arr.push({
      startsAt: row.starts_at, endsAt: row.ends_at, therapySlug: row.therapy_slug,
      bufferMin: bufferBySlug.get(row.therapy_slug) || 0,
      guests: row.bookings?.guests || 1,
      // `children` (Salt Cave: charged, adult-accompanied headcount, capped
      // at 3) isn't a promoted column — it rides in the bookings.data
      // jsonb catch-all like other ad hoc fields (see db-mappers.js).
      children: Math.max(0, Number(row.bookings?.data?.children) || 0),
    });
    scheduleByResource.set(row.resource_id, arr);
  }
  const maintenanceByResource = new Map();
  for (const row of maintRes.data || []) {
    const arr = maintenanceByResource.get(row.resource_id) || [];
    arr.push({ startsAt: row.starts_at, endsAt: row.ends_at });
    maintenanceByResource.set(row.resource_id, arr);
  }
  return { blocks, scheduleByResource, maintenanceByResource, resourcesById };
}

// For a plan, verify each therapy has at least one free resource in its sub-window.
// `context` (from loadAvailabilityContext) enables pure in-memory checks; if
// omitted, a narrow context is loaded internally just for this plan's own
// resources + time window (fine for a single allocateJourney call, wasteful
// for a loop — callers scanning many candidates should pre-load and pass one).
// Returns { ok:boolean, assignments?:[{therapySlug, resourceId, resourceName}] }
export async function checkJourneyAvailability({ plan, therapies, branchId, excludeBookingId = null, sessionMode = null, context = null }) {
  const { blockConflicts } = await import('@/lib/calendar-blocks');

  if (!context) {
    const allResourceIds = therapies.flatMap((t) => t.resourceIds || []);
    const fromIso = plan.reduce((min, s) => Math.min(min, new Date(s.from).getTime()), Infinity);
    const toIso   = plan.reduce((max, s) => Math.max(max, new Date(s.to).getTime()), -Infinity);
    context = await loadAvailabilityContext({
      resourceIds: allResourceIds, branchId,
      fromIso: new Date(fromIso - 24 * 3600000).toISOString(), // pad generously for buffers
      toIso: new Date(toIso + 24 * 3600000).toISOString(),
      excludeBookingId,
    });
  }

  // Checks ONE resource candidate for ONE step's blocked window, purely
  // in-memory against the pre-loaded context. Shared by both the "pick any
  // one from the pool" path (default) and the "concurrentResources" path
  // (combo therapies like Hot & Cold Contrast, which must lock ALL of its
  // resourceIds simultaneously, not just one).
  function isResourceFree(r, step, stepBlockFrom, stepBlockTo) {
    const fromMs = new Date(stepBlockFrom).getTime();
    const toMs   = new Date(stepBlockTo).getTime();

    // Calendar block check — uses the resource's ACTUAL branch (not the query
    // branchId, which may be null when the customer hasn't picked a branch
    // yet). This ensures branch-wide blocks bite correctly.
    const blockedByCalendar = blockConflicts(context.blocks, {
      fromIso: stepBlockFrom, toIso: stepBlockTo,
      branchId: r.branchId || branchId || null, therapySlug: step.therapySlug, resourceId: r.id,
    });
    if (blockedByCalendar) {
      return { free: false, reason: `calendar_block_${blockedByCalendar.scope}_${blockedByCalendar.reason}` };
    }

    // Capacity-aware overlap check. For slot-lock resources (capacity=1),
    // any overlap disqualifies. For additive-capacity resources (Salt Cave
    // capacity=7 with Kids sub-cap 3), count overlapping bookings and
    // reject only when adding this booking exceeds the applicable cap.
    const allItems = context.scheduleByResource.get(r.id) || [];
    const overlaps = allItems.filter((it) => new Date(it.startsAt).getTime() < toMs && new Date(it.endsAt).getTime() + (it.bufferMin || 0) * 60000 > fromMs);

    const resourceCapacity = Math.max(1, Number(r.capacity) || 1);
    if (resourceCapacity <= 1) {
      if (overlaps.length > 0) return { free: false, reason: `capacity_full_${step.therapySlug}` };
    } else {
      // Additive capacity — sum heads (adults + children) on overlapping
      // bookings against the room's physical capacity (e.g. Salt Cave: 7).
      const usedByOverlaps = overlaps.reduce((sum, o) =>
        sum + Math.max(1, Number(o.guests) || 1) + Math.max(0, Number(o.children) || 0), 0);
      const requestedAdults = Math.max(1, Number(step.guests) || 1);
      const requestedChildren = Math.max(0, Math.min(3, Number(step.children) || 0));
      const requested = requestedAdults + requestedChildren;
      // Kids Salt sub-rule (legacy separate product, retired from new online
      // bookings but historical/manual ones may still overlap): if EITHER an
      // existing overlap is a kids booking OR this candidate is a kids
      // booking, hard-cap total at 3.
      let effectiveCap = resourceCapacity;
      const anyKidsOverlap = overlaps.some((o) => String(o.therapySlug || '').includes('kids-salt'));
      const isKidsCandidate = String(step.therapySlug || '').includes('kids-salt');
      if (anyKidsOverlap || isKidsCandidate) effectiveCap = Math.min(effectiveCap, 3);
      if (usedByOverlaps + requested > effectiveCap) {
        return { free: false, reason: `capacity_full_${step.therapySlug}` };
      }
      // Children sub-cap of 3, cumulative across overlapping bookings on this
      // slot — a legacy Kids Salt Therapy overlap counts its whole `guests`
      // as children (that WAS the product), an inline `children` field on a
      // regular Salt Therapy booking counts its own `children`.
      const usedChildren = overlaps.reduce((sum, o) => {
        const isKidsRow = String(o.therapySlug || '').includes('kids-salt');
        return sum + (isKidsRow ? Math.max(0, Number(o.guests) || 0) : Math.max(0, Number(o.children) || 0));
      }, 0);
      const requestedChildUnits = isKidsCandidate ? requestedAdults : requestedChildren;
      if (usedChildren + requestedChildUnits > 3) {
        return { free: false, reason: `capacity_full_${step.therapySlug}_children` };
      }
    }

    // Maintenance block?
    const maint = (context.maintenanceByResource.get(r.id) || []).some(
      (m) => new Date(m.startsAt).getTime() < toMs && new Date(m.endsAt).getTime() > fromMs,
    );
    if (maint) return { free: false, reason: `maintenance_${step.therapySlug}` };

    return { free: true };
  }

  const assignments = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const therapy = therapies[i];
    if (!therapy) return { ok: false };
    let candidates = (therapy.resourceIds || [])
      .map((id) => context.resourcesById.get(id))
      .filter((r) => r && r.active !== false && (!branchId || r.branchId === branchId));
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

    if (therapy.concurrentResources) {
      // Combo therapy (e.g. Hot & Cold Contrast): ALL of resourceIds must be
      // free at once — this is not a pool of interchangeable alternatives,
      // it's a fixed set of rooms the customer occupies simultaneously.
      let blockReason = null;
      for (const r of candidates) {
        const res = await isResourceFree(r, step, stepBlockFrom, stepBlockTo);
        if (!res.free) { blockReason = blockReason || res.reason; break; }
      }
      if (blockReason) return { ok: false, reason: blockReason };
      for (const r of candidates) {
        assignments.push({ therapySlug: step.therapySlug, resourceId: r.id, resourceName: r.name, from: step.from, to: step.to });
      }
      continue;
    }

    let chosen = null;
    let firstBlockReason = null;
    for (const r of candidates) {
      const res = await isResourceFree(r, step, stepBlockFrom, stepBlockTo);
      if (!res.free) { firstBlockReason = firstBlockReason || res.reason; continue; }
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
export async function availableJourneySlots({ therapySlugs, branchId, dateIso, sessionMode = null, durationOverrides = null, guests = 1, children = 0 }) {
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) return null;
  const supabase = getSupabase();
  const { loadBookingRules } = await import('@/lib/booking-rules');
  // These three loads are mutually independent — run them as one network
  // round trip instead of three sequential ones (each hosted-Supabase call
  // costs ~500-700ms of latency alone, so serializing 5 of them is what made
  // this endpoint take 3.5-6s before this fix).
  const [therapies, cfg, preloadedRules] = await Promise.all([
    loadTherapies(supabase, therapySlugs),
    loadSchedulingConfig(branchId),
    loadBookingRules(),
  ]);
  if (therapies.length === 0) return null;

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

  // Pre-load the whole day's resource-occupancy data ONCE — scanning every
  // 15-min slot in the day (below) would otherwise fire a fresh set of
  // queries per candidate, which is fine against local Mongo's near-zero
  // latency but far too slow over the network to a hosted DB.
  const allResourceIds = therapies.flatMap((t) => t.resourceIds || []);
  const context = await loadAvailabilityContext({
    resourceIds: allResourceIds, branchId,
    fromIso: new Date(openUtc.getTime() - 24 * 3600000).toISOString(),
    toIso: new Date(closeUtc.getTime() + 24 * 3600000).toISOString(),
  });

  const groups = { morning: [], afternoon: [], evening: [] };
  let totalDurationMin = 0;
  let totalVisitMin = 0;

  for (let ms = openUtc.getTime(); ms <= closeUtc.getTime() - 15 * 60000; ms += cfg.slotStepMin * 60000) {
    if (ms < earliestUtc) continue;
    const candidate = new Date(ms);

    // Try every ordering of the journey; keep the best bookable one. Booking
    // rules (lead time, cutoffs) are checked PER STEP against that step's own
    // therapy and actual time inside feasibleJourneysForStart — not once
    // against the candidate using the worst-case rule across the whole set,
    // which would wrongly reject candidates just because one therapy that
    // isn't even starting yet (e.g. Float, 90-min lead) needs more notice
    // than the guest has given. Float (if present) snaps its own step to the
    // next fixed anchor time (buildJourneyPlan) wherever it falls in the order.
    const found = await bestJourneyForStart({ candidate, therapies, closeUtc, branchId, sessionMode, context, durationOverrides, guests, children, preloadedRules, closeTimeHHmm: weekOpenClose.close });
    if (!found) continue;
    const journey = found.journey;
    totalDurationMin = journey.totalDurationMin;
    totalVisitMin = journey.totalVisitMin;

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
  durationOverrides = null,
  guests = 1,
  children = 0,
  limit = 3,
  startOffset = 0,
  autoExpand = true,
}) {
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) {
    return { recommendations: [], reason: 'no_therapies' };
  }
  if (!dateIso || !preferredTime) {
    return { recommendations: [], reason: 'missing_input' };
  }
  const supabase = getSupabase();
  const { loadBookingRules } = await import('@/lib/booking-rules');
  // These three loads are mutually independent — run them as one network
  // round trip instead of three sequential ones (each hosted-Supabase call
  // costs ~500-700ms of latency alone).
  const [therapies, cfg, preloadedRules] = await Promise.all([
    loadTherapies(supabase, therapySlugs),
    loadSchedulingConfig(branchId),
    loadBookingRules(),
  ]);
  if (therapies.length === 0) return { recommendations: [], reason: 'therapies_not_found' };

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

  // Pre-load the whole day's resource-occupancy data ONCE — the window-
  // expansion loop below can scan up to a full day of candidates, which
  // would otherwise fire a fresh set of queries per candidate (fine against
  // local Mongo's near-zero latency, far too slow over the network to a
  // hosted DB).
  const allResourceIds = therapies.flatMap((t) => t.resourceIds || []);
  const context = await loadAvailabilityContext({
    resourceIds: allResourceIds, branchId,
    fromIso: new Date(openUtc.getTime() - 24 * 3600000).toISOString(),
    toIso: new Date(closeUtc.getTime() + 24 * 3600000).toISOString(),
  });

  // Score + shape one candidate (start time + order) into the shape the UI
  // consumes. Shared by both the fixed Float-anchor path and the dynamic
  // 15-min-grid path below.
  const scoreCandidate = (candidate, found) => {
    const journey = found.journey;
    let waitingMin = 0;
    for (let i = 1; i < journey.plan.length; i++) {
      const prevTo  = new Date(journey.plan[i - 1].to).getTime();
      const curFrom = new Date(journey.plan[i].from).getTime();
      const gap = Math.max(0, (curFrom - prevTo) / 60000);
      const requiredBuffer = Math.max(
        Number(journey.plan[i - 1].postBufferMin || 0) + Number(journey.plan[i].preBufferMin || 0),
        Math.min(Number(journey.plan[i - 1].cleaningBufferMin || 0), 30),
      );
      waitingMin += Math.max(0, gap - requiredBuffer);
    }
    // Measured against the journey's actual first step, not the raw
    // candidate — Float may have snapped order[0] forward to its next fixed
    // anchor (see buildJourneyPlan), and a candidate that silently jumped
    // 90+ minutes from what the guest asked for must not score as a perfect
    // match just because the untouched `candidate` value looks close.
    const actualFirstStartMs = new Date(journey.plan[0].from).getTime();
    const deltaFromPreferredMin = Math.abs((actualFirstStartMs - preferredUtc.getTime()) / 60000);
    const hhmm = utcToLocalHHmm(candidate);
    return {
      time: hhmm,
      date: dateIso,
      startIso: candidate.toISOString(),
      orderKey: journey.plan.map((p) => p.therapySlug).join('>'),
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
      _score: deltaFromPreferredMin + 0.5 * journey.totalVisitMin + 0.5 * found.fragMin,
    };
  };

  let feasible = [];
  let usedWindow = windowMin;

  // Progressive window expansion. Start with requested (or default 60min);
  // if nothing feasible, widen to 120, then 240, then whole day. When the
  // final window is wider than the requested one, flag `expandedWindow` so
  // the UI can show "no exact match — closest options" copy.
  const requestedWindow = windowMin;
  const windowsToTry = autoExpand
    ? Array.from(new Set([requestedWindow, 120, 240, 720])).filter((w) => w >= requestedWindow)
    : [requestedWindow];

  const step = cfg.slotStepMin || 15;

  for (const win of windowsToTry) {
    const winFromMs = Math.max(openUtc.getTime(), preferredUtc.getTime() - win * 60000);
    const winToMs   = Math.min(closeUtc.getTime() - 15 * 60000, preferredUtc.getTime() + win * 60000);
    const collected = [];
    for (let ms = winFromMs; ms <= winToMs; ms += step * 60000) {
      if (ms < earliestUtc) continue;
      const candidate = new Date(ms);
      // Try every ordering of the journey; keep the best bookable one.
      // Booking rules (lead time, cutoffs) are checked PER STEP against that
      // step's own therapy and actual time inside feasibleJourneysForStart —
      // not once against the candidate using the worst-case rule across the
      // whole set, which would wrongly reject candidates just because one
      // therapy that isn't even starting yet (e.g. Float, 90-min lead) needs
      // more notice than the guest has given. Float (if present) snaps its
      // own step to the next fixed anchor time (buildJourneyPlan) wherever it
      // falls in the order.
      const foundAll = await feasibleJourneysForStart({ candidate, therapies, closeUtc, branchId, sessionMode, context, durationOverrides, guests, children, preloadedRules, closeTimeHHmm: closeTime });
      // Offer at most the 2 best distinct orders per start time.
      for (const found of foundAll.slice(0, 2)) {
        collected.push(scoreCandidate(candidate, found));
      }
    }
    if (collected.length > 0) {
      feasible = collected;
      usedWindow = win;
      break;
    }
  }

  return finishRecommendJourneys({ feasible, requestedWindow, usedWindow, limit, startOffset });
}

// Ranking + pagination tail shared by both the fixed Float-anchor path and
// the dynamic 15-min-grid path in recommendJourneys.
function finishRecommendJourneys({ feasible, requestedWindow, usedWindow, limit, startOffset }) {
  if (feasible.length === 0) {
    return {
      recommendations: [], closed: false, reason: 'no_availability',
      totalDurationMin: 0, totalVisitMin: 0, requestedWindow, usedWindow: null,
    };
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
    if (!candidate || globalSeen.has(candidate.startIso + candidate.orderKey)) return;
    globalSeen.add(candidate.startIso + candidate.orderKey);
    const { _score, ...cleanCand } = candidate;
    globalPicks.push({ ...cleanCand, badge, badgeLabel });
  };
  let bi = 0, fi = 0, wi = 0;
  const target = startOffset + limit;
  while (globalPicks.length < target) {
    const before = globalPicks.length;
    while (bi < byBest.length    && globalSeen.has(byBest[bi].startIso + byBest[bi].orderKey))    bi++;
    if (bi < byBest.length)    pushPick(byBest[bi++],    'best_match',     'Best Match');
    if (globalPicks.length >= target) break;
    while (fi < byFastest.length && globalSeen.has(byFastest[fi].startIso + byFastest[fi].orderKey)) fi++;
    if (fi < byFastest.length) pushPick(byFastest[fi++], 'fastest_finish', 'Fastest Finish');
    if (globalPicks.length >= target) break;
    while (wi < byWait.length    && globalSeen.has(byWait[wi].startIso + byWait[wi].orderKey))    wi++;
    if (wi < byWait.length)    pushPick(byWait[wi++],    'least_waiting',  'Least Waiting');
    if (globalPicks.length === before) break; // no progress possible
  }
  const picks = globalPicks.slice(startOffset, startOffset + limit);

  return {
    totalDurationMin: feasible[0].totalDurationMin,
    totalVisitMin:    feasible[0].totalVisitMin,
    recommendations:  picks,
    availableCount:   feasible.length,
    requestedWindow,
    usedWindow,
    expandedWindow:   usedWindow > requestedWindow,
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
export async function allocateJourney({ therapySlugs, branchId, startIso, excludeBookingId = null, sessionMode = null, durationOverrides = null, guests = 1, children = 0, plan: suppliedPlan = null }) {
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) return { ok: false, reason: 'no_therapies' };
  const supabase = getSupabase();
  let therapies = await loadTherapies(supabase, therapySlugs);
  if (therapies.length === 0) return { ok: false, reason: 'therapies_not_found' };

  let journey;
  if (Array.isArray(suppliedPlan) && suppliedPlan.length > 0) {
    // Manual mode (ManualJourneyPicker) lets the customer pick each leg's
    // own independent time, not necessarily back-to-back. Honor those exact
    // times instead of re-deriving a tight back-to-back plan from just the
    // first leg's start — that would silently discard the customer's chosen
    // gaps and misapply buffers between legs that were never meant to be
    // adjacent (e.g. Infrared Sauna 12:30, Float 16:00, Cold Plunge 18:00).
    const bySlug = new Map(therapies.map((t) => [t.slug, t]));
    // The plan may be in a different order than therapySlugs (the recommender
    // picks the best sequence) — re-align so plan[i] ↔ therapies[i].
    therapies = suppliedPlan.map((p) => bySlug.get(p.therapySlug || p.slug)).filter(Boolean);
    const plan = suppliedPlan.map((p) => {
      const t = bySlug.get(p.therapySlug || p.slug);
      const overrideDur = durationOverrides && Number(durationOverrides[p.therapySlug || p.slug]);
      const dur = overrideDur > 0 ? overrideDur : (Number(p.durationMin) || Number(t?.durationMin) || 60);
      return {
        therapySlug: p.therapySlug || p.slug,
        name: t?.name || p.name,
        from: p.from,
        to: p.to || new Date(new Date(p.from).getTime() + dur * 60000).toISOString(),
        durationMin: dur,
        preBufferMin: Number(t?.preBufferMin) || 0,
        postBufferMin: Number(t?.postBufferMin) || 0,
        cleaningBufferMin: Number(t?.cleaningBufferMin) || 0,
        guests: Math.max(1, Number(guests) || 1),
        children: Math.max(0, Math.min(3, Number(children) || 0)),
      };
    });
    const first = plan[0], last = plan[plan.length - 1];
    const visitFrom = new Date(new Date(first.from).getTime() - (first.preBufferMin || 0) * 60000).toISOString();
    const visitTo = new Date(new Date(last.to).getTime() + (last.cleaningBufferMin || 0) * 60000).toISOString();
    const totalDurationMin = plan.reduce((sum, s) => sum + (s.durationMin || 0), 0);
    const totalVisitMin = Math.round((new Date(visitTo).getTime() - new Date(visitFrom).getTime()) / 60000);
    journey = { plan, visitFrom, visitTo, totalDurationMin, totalVisitMin };
  } else {
    // No explicit plan (e.g. reschedule): pick whichever ORDER of the
    // therapies is bookable at this start, same as the recommender does.
    const start = new Date(startIso);
    const ctx = await loadAvailabilityContext({
      resourceIds: therapies.flatMap((t) => t.resourceIds || []), branchId,
      fromIso: new Date(start.getTime() - 24 * 3600000).toISOString(),
      toIso: new Date(start.getTime() + 48 * 3600000).toISOString(),
      excludeBookingId,
    });
    const found = await bestJourneyForStart({ candidate: start, therapies, closeUtc: new Date(8.64e15), branchId, sessionMode, context: ctx, durationOverrides, guests, children });
    if (found) { journey = found.journey; therapies = found.therapies; }
    else journey = buildJourneyPlan(start, therapies, { durationOverrides, guests, children });
  }
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
export async function suggestNextAvailableSlots({ therapySlugs, branchId, startIso, sessionMode = null, durationOverrides = null, guests = 1, children = 0, limit = 5 }) {
  const suggestions = [];
  if (!Array.isArray(therapySlugs) || therapySlugs.length === 0) return suggestions;
  const start = new Date(startIso);
  const istOffset = 330 * 60000;
  const localMs = start.getTime() + istOffset;
  const localDay = new Date(localMs).toISOString().slice(0, 10);
  const localTime = new Date(localMs).toISOString().slice(11, 16);

  // Same day, times strictly after the failed one.
  const today = await availableJourneySlots({ therapySlugs, branchId, dateIso: localDay, sessionMode, durationOverrides, guests, children });
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
      const r = await availableJourneySlots({ therapySlugs, branchId, dateIso: nextDay, sessionMode, durationOverrides, guests, children });
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
