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
import { getSupabase } from '@/lib/supabase';

export const BLOCK_SCOPES = ['resource', 'therapy', 'branch'];
export const BLOCK_REASONS = [
  'maintenance', 'holiday', 'staff_leave', 'private_event',
  'equipment_servicing', 'group_booking', 'other',
];

function toBlock(row) {
  if (!row) return null;
  const { data, ...c } = row;
  return {
    ...data,
    id: c.id, scope: c.scope, branchId: c.branch_id, therapySlug: c.therapy_slug,
    resourceId: c.resource_id, startAt: c.starts_at, endAt: c.ends_at,
    reason: c.reason, createdBy: c.created_by, createdAt: c.created_at,
  };
}

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
  const supabase = getSupabase();
  const { error } = await supabase.from('calendar_blocks').insert({
    id: doc.id, scope: doc.scope, branch_id: doc.branchId, therapy_slug: doc.therapySlug,
    resource_id: doc.resourceId, starts_at: doc.startAt, ends_at: doc.endAt, reason: doc.reason,
    created_by: doc.createdBy, created_at: doc.createdAt,
    data: { reasonNote: doc.reasonNote },
  });
  if (error) throw error;
  return doc; // pristine, matches what was requested
}

export async function listBlocks({ from, to, branchId } = {}) {
  const supabase = getSupabase();
  let query = supabase.from('calendar_blocks').select('*').order('starts_at', { ascending: true });
  // A block overlaps [from,to] iff block.startAt < to AND block.endAt > from
  if (to)   query = query.lt('starts_at', to);
  if (from) query = query.gt('ends_at', from);
  if (branchId) query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  const { data: rows, error } = await query;
  if (error) throw error;
  return rows.map(toBlock);
}

/**
 * Bulk-load every block overlapping [fromIso,toIso] in ONE query, for
 * in-memory matching by callers that need to check many (step, resource)
 * combinations without re-querying per check (e.g. the availability-grid
 * scan in lib/scheduling.js, which would otherwise fire one query per
 * candidate slot). Filter with `blockConflicts()` below.
 */
export async function listBlocksOverlapping({ fromIso, toIso }) {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase.from('calendar_blocks').select('*')
    .lt('starts_at', toIso).gt('ends_at', fromIso);
  if (error) throw error;
  return (rows || []).map(toBlock);
}

/** In-memory equivalent of findConflictingBlock's scope-matching, against a
 * pre-loaded block list from listBlocksOverlapping(). */
export function blockConflicts(blocks, { fromIso, toIso, branchId = null, therapySlug = null, resourceId = null }) {
  const overlaps = (b) => new Date(b.startAt).getTime() < new Date(toIso).getTime()
    && new Date(b.endAt).getTime() > new Date(fromIso).getTime();
  for (const b of blocks) {
    if (!overlaps(b)) continue;
    if (b.scope === 'branch' && (b.branchId === branchId || b.branchId == null)) return b;
    if (b.scope === 'therapy' && therapySlug && b.therapySlug === therapySlug && (b.branchId === branchId || b.branchId == null)) return b;
    if (b.scope === 'resource' && resourceId && b.resourceId === resourceId) return b;
  }
  return null;
}

export async function deleteBlock(id) {
  const supabase = getSupabase();
  await supabase.from('calendar_blocks').delete().eq('id', id);
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
 *
 * Runs the three scopes as separate queries (rather than one combined OR
 * expression) — clearer to read/debug, and cheap since calendar blocks are a
 * small table.
 */
export async function findConflictingBlock({ fromIso, toIso, branchId = null, therapySlug = null, resourceId = null }) {
  const supabase = getSupabase();
  const timeOverlap = (q) => q.lt('starts_at', toIso).gt('ends_at', fromIso);

  let query = timeOverlap(supabase.from('calendar_blocks').select('*').eq('scope', 'branch'))
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .limit(1);
  let { data: rows } = await query;
  if (rows?.length) return toBlock(rows[0]);

  if (therapySlug) {
    query = timeOverlap(supabase.from('calendar_blocks').select('*').eq('scope', 'therapy').eq('therapy_slug', therapySlug))
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .limit(1);
    ({ data: rows } = await query);
    if (rows?.length) return toBlock(rows[0]);
  }

  if (resourceId) {
    query = timeOverlap(supabase.from('calendar_blocks').select('*').eq('scope', 'resource').eq('resource_id', resourceId)).limit(1);
    ({ data: rows } = await query);
    if (rows?.length) return toBlock(rows[0]);
  }

  return null;
}
