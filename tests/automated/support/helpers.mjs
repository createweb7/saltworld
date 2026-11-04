// Shared helpers for the automated booking tests (node:test, no extra deps).
//
// BASE_URL picks the site under test (default: the live site). Everything
// here is plain fetch against the public / admin API — the same calls the
// booking pages and admin make.
import { readFileSync } from 'fs';

export const BASE = (process.env.BASE_URL || 'https://saltworld.vercel.app').replace(/\/$/, '');

const IST_MIN = 330;

export async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, headers: res.headers };
}

// YYYY-MM-DD in IST, n days from today.
export function istDate(daysAhead = 0) {
  return new Date(Date.now() + IST_MIN * 60000 + daysAhead * 86400000).toISOString().slice(0, 10);
}

export function istIso(dateYmd, hhmm) {
  return new Date(`${dateYmd}T${hhmm}:00+05:30`).toISOString();
}

export function istHHmm(iso) {
  return new Date(new Date(iso).getTime() + IST_MIN * 60000).toISOString().slice(11, 16);
}

export function minutesBetween(fromIso, toIso) {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000;
}

export function slotTimes(slotsResponse) {
  const g = slotsResponse?.groups || {};
  return ['morning', 'afternoon', 'evening'].flatMap((k) => g[k] || []);
}

export function loadJson(relPath) {
  return JSON.parse(readFileSync(new URL(relPath, import.meta.url), 'utf8'));
}

// Rules from the business's "Booking System – Rules for Booking" doc.
export const RULES = {
  floatTimes: ['08:00', '10:30', '13:00', '15:30', '18:00', '20:30'],
  firstSlot: '08:00',
  lastSlot: '21:00',
  // Guest's wait after each therapy before their next one.
  guestWaitAfter: { 'salt-therapy': 15, 'float-therapy': 30, 'infrared-sauna': 30, 'cold-plunge': 30, 'red-light-therapy': 15 },
  // Room free again after a session (post + cleaning buffer).
  roomGapAfter: { 'salt-therapy': 20, 'float-therapy': 60, 'infrared-sauna': 30, 'cold-plunge': 30, 'red-light-therapy': 15 },
  leadMin: { 'salt-therapy': 30, 'float-therapy': 90, 'red-light-therapy': 15, 'infrared-sauna': 15, 'cold-plunge': 45 },
};

export const SESSION_MODE_THERAPIES = new Set(['float-therapy', 'infrared-sauna', 'cold-plunge', 'red-light-therapy']);

// Request lines exactly as /book sends them.
export function bookLines(slugs, mode, floatMin) {
  return slugs.map((slug) => ({
    slug,
    sessionMode: SESSION_MODE_THERAPIES.has(slug) ? mode : undefined,
    durationMin: slug === 'float-therapy' ? floatMin : undefined,
  }));
}

export function guestsFor(slugs, mode) {
  return mode === 'couple' && slugs.includes('salt-therapy') ? 2 : 1;
}
