// Salt World — centralised date & time formatting.
// Everything in the app should render dates through these helpers.
//   Date: DD/MM/YYYY   (Indian civil format)
//   Time: 12-hour with AM/PM
// Time-zone-safe when a Date instance is passed; robust to ISO strings and epoch ms.

function toDate(input) {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function pad(n) { return n < 10 ? `0${n}` : String(n); }

export function formatDate(input, { fallback = '—' } = {}) {
  const d = toDate(input);
  if (!d) return fallback;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatTime(input, { fallback = '—', seconds = false } = {}) {
  const d = toDate(input);
  if (!d) return fallback;
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return seconds ? `${h}:${m}:${s} ${suffix}` : `${h}:${m} ${suffix}`;
}

export function formatDateTime(input, opts = {}) {
  const d = toDate(input);
  if (!d) return opts.fallback || '—';
  return `${formatDate(d, opts)}, ${formatTime(d, opts)}`;
}

// "5 Jul 2026" style for editorial contexts (journal, invoice PDFs, etc.).
export function formatDateLong(input, { fallback = '—' } = {}) {
  const d = toDate(input);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return formatDate(d);
  }
}

// Relative helper for "2 hours ago" style feeds (dashboard activity, etc.).
export function formatRelative(input, { fallback = '—' } = {}) {
  const d = toDate(input);
  if (!d) return fallback;
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const sign = diffSec < 0 ? 'in ' : '';
  const suffix = diffSec < 0 ? '' : ' ago';
  const pick = (n, unit) => `${sign}${n} ${unit}${n === 1 ? '' : 's'}${suffix}`;
  if (abs < 45) return 'just now';
  if (abs < 3600)     return pick(Math.round(abs / 60), 'min');
  if (abs < 86400)    return pick(Math.round(abs / 3600), 'hour');
  if (abs < 604800)   return pick(Math.round(abs / 86400), 'day');
  if (abs < 2629800)  return pick(Math.round(abs / 604800), 'week');
  return formatDate(d);
}

// Date range chip helpers used by /admin/bookings filters.
export function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function tomorrowRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function thisWeekRange() {
  const start = new Date();
  const day = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function rangeFromChip(chip) {
  switch (chip) {
    case 'today':    return todayRange();
    case 'tomorrow': return tomorrowRange();
    case 'week':     return thisWeekRange();
    case 'month':    return thisMonthRange();
    default:         return null;
  }
}

/**
 * Return the LOCAL calendar date of `d` (or now) as an ISO date string yyyy-MM-dd.
 * NEVER uses toISOString() which converts to UTC and can shift the date by ±1 day
 * around midnight in non-UTC zones (this is what caused the "book past date" bug).
 */
export function toLocalIsoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}
