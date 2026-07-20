// Resource allocation + slot availability for the booking engine.
//
// A therapy has 0-N resources (rooms, tanks, pools). Each resource carries
// a branchId. When a booking is created, the engine picks the first free
// resource for the requested time window. Availability calculations use the
// therapy's pre-buffer, session, post-buffer, and cleaning-buffer.

import { getDb } from '@/lib/mongo';

// Compute the [start, end] window a booking blocks for its resource.
// start  = requested startAt - preBuffer
// end    = requested startAt + duration + postBuffer + cleaningBuffer
export function computeBlockWindow(startIso, therapy) {
  const start = new Date(startIso);
  const pre = Number(therapy?.preBufferMin || 0);
  const post = Number(therapy?.postBufferMin || 0);
  const clean = Number(therapy?.cleaningBufferMin || 0);
  const dur = Number(therapy?.durationMin || 60);
  const from = new Date(start.getTime() - pre * 60000);
  const to = new Date(start.getTime() + (dur + post + clean) * 60000);
  return { from, to };
}

// Find the first free resource for a therapy at a given time in a branch.
// Returns { resourceId, resourceName } or null if all resources are busy.
export async function allocateResource({ therapySlug, branchId, startIso, excludeBookingId = null }) {
  if (!therapySlug || !startIso) return null;
  const db = await getDb();
  const therapy = await db.collection('therapies').findOne({ slug: therapySlug });
  if (!therapy) return null;
  const { from, to } = computeBlockWindow(startIso, therapy);

  // Candidate resources: linked to this therapy, active, and (if branchId
  // supplied) scoped to that branch. Fall back to therapy.resourceIds
  // membership if the resource somehow has no branchId (legacy).
  const query = {
    id: { $in: therapy.resourceIds || [] },
    active: { $ne: false },
  };
  if (branchId) {
    query.$or = [{ branchId }, { branchId: { $exists: false } }, { branchId: null }];
  }
  const candidates = await db.collection('resources').find(query).toArray();
  if (candidates.length === 0) return null;

  // Find each candidate's overlapping bookings.
  for (const r of candidates) {
    const overlap = await db.collection('bookings').findOne({
      resourceId: r.id,
      status: { $nin: ['cancelled', 'no_show'] },
      ...(excludeBookingId ? { id: { $ne: excludeBookingId } } : {}),
      // Overlap iff booking.blockedFrom < to AND booking.blockedTo > from.
      blockedFrom: { $lt: to.toISOString() },
      blockedTo: { $gt: from.toISOString() },
    });
    if (!overlap) {
      return { resourceId: r.id, resourceName: r.name, blockedFrom: from.toISOString(), blockedTo: to.toISOString() };
    }
  }
  return null;
}

// List available slot-count for each 30-min slot on a given day.
// Returns array of { time:'HH:mm', available:number, total:number }.
export async function daySlots({ therapySlug, branchId, dateIso }) {
  const db = await getDb();
  const therapy = await db.collection('therapies').findOne({ slug: therapySlug });
  if (!therapy) return [];
  const total = (therapy.resourceIds || []).length || 1;

  const day = new Date(dateIso);
  day.setUTCHours(0, 0, 0, 0);
  const slots = [];
  // Business hours: 06:00-21:00 by default. Could pull from branch.hours.
  for (let h = 6; h < 21; h++) {
    for (const m of [0, 30]) {
      const t = new Date(day);
      t.setUTCHours(h - 5, m + -30, 0, 0); // IST offset roughly — real impl should use branch tz
      const startIso = new Date(day).toISOString().slice(0, 10) + `T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000+05:30`;
      const alloc = await allocateResource({ therapySlug, branchId, startIso });
      slots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        available: alloc ? 1 : 0,
        total,
      });
    }
  }
  return slots;
}
