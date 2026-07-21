// Salt World — Booking rules (cancel / reschedule cutoff).
//
// Rule: A customer may only cancel or reschedule a booking until a
// configurable cutoff time on the day BEFORE the booking. Default 21:00 IST.
//
// Admins overriding this must always block the whole day via calendar-blocks
// instead of overriding cutoffs. Confirmed by product spec 2026-07.

import { getDb } from '@/lib/mongo';

const IST_OFFSET_MIN = 330;
export const DEFAULT_CUTOFF_TIME = '21:00';

export async function loadBookingRules() {
  const db = await getDb();
  const doc = await db.collection('settings').findOne({ key: 'bookingRules' });
  const value = doc?.value || {};
  return {
    cutoffTime: value.cutoffTime || DEFAULT_CUTOFF_TIME,  // 'HH:mm' IST
    cutoffDaysBefore: Number(value.cutoffDaysBefore ?? 1),
    minRescheduleNoticeMin: Number(value.minRescheduleNoticeMin || 0),
  };
}

export async function saveBookingRules(patch, actorId = null) {
  const db = await getDb();
  const now = new Date().toISOString();
  const cur = (await loadBookingRules());
  const next = {
    cutoffTime: patch.cutoffTime || cur.cutoffTime,
    cutoffDaysBefore: Number(patch.cutoffDaysBefore ?? cur.cutoffDaysBefore),
    minRescheduleNoticeMin: Number(patch.minRescheduleNoticeMin ?? cur.minRescheduleNoticeMin),
  };
  await db.collection('settings').updateOne(
    { key: 'bookingRules' },
    { $set: { key: 'bookingRules', value: next, updatedAt: now, updatedBy: actorId }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  return next;
}

/**
 * Returns the ISO cutoff Date for a booking that starts at bookingStartIso.
 * Example: booking on 2026-08-10 09:00 IST with cutoff 21:00 & daysBefore=1
 *          → cutoff is 2026-08-09 21:00 IST.
 */
export function computeCutoffForBooking(bookingStartIso, rules) {
  const start = new Date(bookingStartIso);
  // shift to IST wall clock, subtract N days, set to cutoff HH:mm, then back to UTC.
  const istMs = start.getTime() + IST_OFFSET_MIN * 60000;
  const ist = new Date(istMs);
  const [h, m] = String(rules.cutoffTime || DEFAULT_CUTOFF_TIME).split(':').map(Number);
  ist.setUTCDate(ist.getUTCDate() - Number(rules.cutoffDaysBefore || 1));
  ist.setUTCHours(h, m, 0, 0);
  const cutoffUtc = new Date(ist.getTime() - IST_OFFSET_MIN * 60000);
  return cutoffUtc;
}

/**
 * Throws { code, message, cutoff } if a customer‑initiated mutation is past
 * the cutoff. Pass action='cancel' or 'reschedule' for accurate messaging.
 */
export async function assertCustomerCanMutate(booking, action = 'cancel') {
  if (!booking?.startAt) return { ok: true, reason: 'no_start' };
  const rules = await loadBookingRules();
  const cutoff = computeCutoffForBooking(booking.startAt, rules);
  const now = new Date();
  if (now.getTime() > cutoff.getTime()) {
    const errObj = new Error(`${action}_cutoff_passed`);
    errObj.code = 'cutoff_passed';
    errObj.cutoff = cutoff.toISOString();
    errObj.rules = rules;
    throw errObj;
  }
  return { ok: true, cutoff: cutoff.toISOString() };
}
