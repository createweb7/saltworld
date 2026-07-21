// Salt World — Calendar Blocks engine.
//
// Reception/Admin can create blocks that mark portions of the calendar as
// unavailable to customers. Blocks are ALWAYS checked by the scheduling
// engine before returning available slots or confirming a booking.
//
// Scope hierarchy (specific → broad):
//   resource  — one physical resource (e.g., Float Tank 1) offline
//   therapy   — one therapy at one branch offline (e.g., Salt Cave)
//   branch    — entire branch closed (holiday, maintenance)
//
// Time model:
//   Blocks store startAt / endAt as ISO UTC. For half-day / full-day scopes
//   the admin UI converts to concrete UTC ranges before saving.

import { randomUUID } from 'crypto';
import { getDb } from '@/lib/mongo';

const COL = 'calendar_blocks';

export const BLOCK_SCOPES = ['resource', 'therapy', 'branch'];
export const BLOCK_REASONS = [
  'maintenance', 'holiday', 'staff_leave', 'private_event',
  'equipment_servicing', 'group_booking', 'other',
];

function normalizeBlock(input) {
  return {
    id: input.id || randomUUID(),
    scope: BLOCK_SCOPES.includes(input.scope) ? input.scope : 'branch',
    branchId:    input.branchId    || null,
    therapySlug: input.therapySlug || null,
    resourceId:  input.resourceId  || null,
    startAt: input.startAt,   // ISO UTC
    endAt:   input.endAt,     // ISO UTC
    reason:  BLOCK_REASONS.includes(input.reason) ? input.reason : 'other',
    reasonNote: input.reasonNote || '',
    createdBy: input.createdBy || null,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export async function createBlock(input) {
  if (!input.startAt || !input.endAt) throw new Error('startAt_endAt_required');
  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    throw new Error('endAt_must_be_after_startAt');
  }
  const doc = normalizeBlock(input);
  const db = await getDb();
  await db.collection(COL).insertOne({ ...doc });
  return doc; // pristine (no _id leak)
}

export async function listBlocks({ from, to, branchId } = {}) {
  const db = await getDb();
  const q = {};
  if (from || to) {
    // A block overlaps [from,to] iff block.startAt < to AND block.endAt > from
    q.$and = [];
    if (to)   q.$and.push({ startAt: { $lt: to   } });
    if (from) q.$and.push({ endAt:   { $gt: from } });
    if (q.$and.length === 0) delete q.$and;
  }
  if (branchId) {
    // include branch-scoped blocks for that branch, OR blocks that don't
    // specify a branch (global — rare but valid).
    q.$or = [{ branchId }, { branchId: null }];
  }
  const docs = await db.collection(COL).find(q).sort({ startAt: 1 }).toArray();
  return docs.map((d) => { const { _id, ...rest } = d; return rest; });
}

export async function deleteBlock(id) {
  const db = await getDb();
  await db.collection(COL).deleteOne({ id });
  return { ok: true };
}

/**
 * Does the given (from,to) window overlap ANY active block that matches the
 * given scope filters? Returns the first offending block for messaging.
 *
 * A block bites the window if:
 *   • block.scope='branch'   AND block.branchId===branchId   (or null)
 *   • block.scope='therapy' AND block.therapySlug===therapySlug (and branch matches or null)
 *   • block.scope='resource' AND block.resourceId===resourceId
 */
export async function findConflictingBlock({ fromIso, toIso, branchId = null, therapySlug = null, resourceId = null }) {
  const db = await getDb();
  const timeOverlap = { startAt: { $lt: toIso }, endAt: { $gt: fromIso } };

  const or = [];
  or.push({
    ...timeOverlap,
    scope: 'branch',
    $or: [{ branchId }, { branchId: null }],
  });
  if (therapySlug) {
    or.push({
      ...timeOverlap,
      scope: 'therapy',
      therapySlug,
      $or: [{ branchId }, { branchId: null }],
    });
  }
  if (resourceId) {
    or.push({
      ...timeOverlap,
      scope: 'resource',
      resourceId,
    });
  }
  const doc = await db.collection(COL).findOne({ $or: or });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}
