'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Loader2, ArrowLeft } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';
import { toLocalIsoDay } from '@/lib/date';

/* ------------------------------------------------------------------ */
/* Slot grid                                                          */
/* ------------------------------------------------------------------ */

const START_HOUR = 6;   // 06:00
const END_HOUR   = 22;  // 22:00
const SLOT_MIN   = 15;  // 15-min columns — matches the customer booking cadence
const SLOTS = Array.from(
  { length: ((END_HOUR - START_HOUR) * 60) / SLOT_MIN },
  (_, i) => {
    const total = START_HOUR * 60 + i * SLOT_MIN;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
);

/** Convert an ISO instant to HH:mm in IST (fixed +05:30 offset). */
function istHHmm(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const shifted = new Date(d.getTime() + 330 * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** Duration in slot-columns for an ISO from/to pair. */
function slotsBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return 1;
  const mins = Math.max(SLOT_MIN, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
  return Math.max(1, Math.round(mins / SLOT_MIN));
}

/** Column index (0-based, into SLOTS) for an ISO instant. Null if outside the visible day range. */
function colIndexForIso(iso) {
  const hhmm = istHHmm(iso);
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const idx = Math.floor((h * 60 + m - START_HOUR * 60) / SLOT_MIN);
  return idx;
}

const LANE_HEIGHT = 28;   // px per concurrent booking "lane" within a resource row
const BADGE_STRIP = 16;   // px reserved at the top of a cell for the occupancy badge

async function fetchCalendar(fromISO, toISO) {
  const res = await fetch(`/api/admin/bookings/calendar?from=${fromISO}&to=${toISO}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

async function fetchResources(branchId) {
  const q = branchId ? `?branchId=${branchId}` : '';
  const res = await fetch(`/api/admin/resources${q}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function CalendarClient({ user }) {
  const [date, setDate] = useState(new Date());
  const dayStart = useMemo(() => { const d = new Date(date); d.setHours(0,0,0,0); return d; }, [date]);
  const dayEnd   = useMemo(() => { const d = new Date(date); d.setHours(23,59,59,999); return d; }, [date]);

  // Bookings for the current day.
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['calendar', toLocalIsoDay(dayStart)],
    queryFn: () => fetchCalendar(dayStart.toISOString(), dayEnd.toISOString()),
  });

  // Resources — the row list. Filter to active + branch-scoped is done server-side.
  const { data: resources = [] } = useQuery({
    queryKey: ['calendar-resources'],
    queryFn: () => fetchResources(),
  });

  // Bucket bookings by resource, then lane-assign overlapping ones (classic
  // interval-partitioning) so simultaneous bookings on a multi-capacity
  // resource (e.g. Salt Cave — up to 7 independent bookings at once) render
  // as separate side-by-side cards instead of stacking on top of each other.
  // Also computes per-column occupancy (sum of guests active in that slot)
  // for the capacity badge. For journey bookings that traverse multiple
  // resources we walk `schedule[]` — each step lives on its own row.
  const resourceLayout = useMemo(() => {
    const byResource = {};
    for (const b of bookings) {
      const steps = Array.isArray(b.schedule) && b.schedule.length > 0
        ? b.schedule.map((s) => ({
            resourceId: s.resourceId,
            resourceName: s.resourceName,
            from: s.from,
            to: s.to,
            blockedTo: s.blockedTo || s.to,
            therapyName: s.therapyName || s.therapySlug || b.therapy || b.therapyLabel,
          }))
        : [{
            resourceId: b.resourceId,
            resourceName: b.resourceName,
            from: b.startAt || (b.slotDate && b.slotTime ? `${b.slotDate}T${b.slotTime}:00+05:30` : null),
            to: b.blockedTo || null,
            blockedTo: b.blockedTo || null,
            therapyName: b.therapyLabel || b.therapy || b.outcomeLabel || b.outcome,
          }];
      for (const step of steps) {
        if (!step.resourceId || !step.from) continue;
        const colStart = colIndexForIso(step.from);
        if (colStart == null || colStart < 0 || colStart >= SLOTS.length) continue;
        // The room stays held past the session's raw end for its post/
        // cleaning buffer (`blockedTo`, from the therapy's own config) —
        // render that trailing stretch too, visually distinct from the
        // actual session, so the calendar doesn't make a still-occupied
        // room look free (reported: block shown ending 15 min early).
        const sessionSpan = slotsBetween(step.from, step.to);
        const sessionColEnd = Math.min(SLOTS.length, colStart + sessionSpan);
        const fullSpan = slotsBetween(step.from, step.blockedTo || step.to);
        const colEnd = Math.min(SLOTS.length, colStart + fullSpan); // exclusive
        const guests = Math.max(1, Number(b.guests) || 1);
        const children = Math.max(0, Number(b.children) || 0);
        (byResource[step.resourceId] = byResource[step.resourceId] || [])
          .push({ booking: b, step, colStart, sessionColEnd, colEnd, guests, children });
      }
    }

    const layout = {};
    for (const [resourceId, items] of Object.entries(byResource)) {
      items.sort((a, b2) => a.colStart - b2.colStart);
      // Greedy lane assignment: place each item in the first lane whose last
      // item already ended by this item's start; otherwise open a new lane.
      const laneEnds = [];
      for (const item of items) {
        let lane = laneEnds.findIndex((end) => end <= item.colStart);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
        item.lane = lane;
        laneEnds[lane] = item.colEnd;
      }
      const occupancy = new Array(SLOTS.length).fill(0);
      for (const item of items) {
        for (let c = item.colStart; c < item.colEnd; c++) occupancy[c] += item.guests + item.children;
      }
      layout[resourceId] = { items, laneCount: Math.max(1, laneEnds.length), occupancy };
    }
    return layout;
  }, [bookings]);

  const shift = (delta) => { const d = new Date(date); d.setDate(d.getDate() + delta); setDate(d); };
  const today = () => setDate(new Date());

  return (
    <AdminShell
      user={user}
      title="Calendar"
      actions={
        <Link href="/admin/bookings" className="h-8 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-muted">
          <ArrowLeft className="h-3 w-3" /> All bookings
        </Link>
      }
    >
      <PageHeader
        eyebrow="Operations"
        title={date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="h-8 w-8 rounded-md border border-border hover:bg-muted inline-flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={today} className="h-8 px-3 rounded-md border border-border text-[12.5px] hover:bg-muted">Today</button>
            <button onClick={() => shift(1)} className="h-8 w-8 rounded-md border border-border hover:bg-muted inline-flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      />
      <AdminSection className="pt-2">
        {isLoading && <div className="text-center py-16"><Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" /></div>}
        {!isLoading && resources.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <CalIcon className="h-6 w-6 mx-auto text-muted-foreground" />
            <div className="mt-3 font-medium text-[14px]">No resources yet</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">
              Add resources under <Link href="/admin/services" className="underline">Services</Link> to see the day&rsquo;s schedule.
            </div>
          </div>
        )}
        {!isLoading && resources.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <div className="min-w-[1400px] grid" style={{ gridTemplateColumns: `160px repeat(${SLOTS.length}, minmax(44px, 1fr))` }}>
              {/* Header row */}
              <div className="sticky left-0 z-10 bg-card border-r border-b border-border text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold px-3 py-2">Resource</div>
              {/* Each label sits ON its column's left gridline (ruler-style
                  tick), not inside the cell — so a 10:30–11:30 booking spans
                  exactly from the "10:30" tick to the "11:30" tick. Labels
                  inside the cell put "11:15" directly above the last quarter
                  of that bar, which read as "ends at 11:15". */}
              {SLOTS.map((s) => (
                <div key={s} className="relative h-9 border-b border-l border-border">
                  <span className={cn(
                    'absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 px-0.5 bg-card text-[10.5px] text-muted-foreground font-mono whitespace-nowrap',
                    s.endsWith(':00') ? 'text-foreground/70 font-semibold' : ''
                  )}>{s}</span>
                </div>
              ))}
              {resources.map((r) => (
                <FragmentRow key={r.id} r={r} layout={resourceLayout[r.id]} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-[11.5px] text-muted-foreground flex-wrap">
          <LegendDot cls="bg-blue-500/70" label="Confirmed" />
          <LegendDot cls="bg-amber-500/80" label="Checked in" />
          <LegendDot cls="bg-purple-500/80" label="In session" />
          <LegendDot cls="bg-muted" label="Completed" />
          <LegendDot cls="bg-red-500/70" label="Cancelled / No-show" />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm border border-dashed border-foreground/40" /> Room reset buffer (held, not in-session)
          </span>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ */
/* Row + status                                                       */
/* ------------------------------------------------------------------ */

function FragmentRow({ r, layout }) {
  const capacity = Number(r.capacity) || 1;
  const showBadges = capacity > 1;
  const laneCount = Math.max(1, layout?.laneCount || 1);
  const cellHeight = showBadges
    ? BADGE_STRIP + laneCount * LANE_HEIGHT + 4
    : Math.max(56, laneCount * LANE_HEIGHT + 4);
  const itemsByStartCol = useMemo(() => {
    const m = {};
    for (const item of layout?.items || []) (m[item.colStart] = m[item.colStart] || []).push(item);
    return m;
  }, [layout]);

  return (
    <>
      <div className="sticky left-0 z-10 bg-card border-r border-b border-border px-3 py-3 text-[12.5px] font-medium truncate flex items-center gap-1"
        style={{ height: cellHeight }}>
        {r.name}
        {showBadges && <span className="text-[10px] text-muted-foreground font-mono">cap {capacity}</span>}
      </div>
      {SLOTS.map((s, colIdx) => {
        const cellItems = itemsByStartCol[colIdx] || [];
        const occ = layout?.occupancy?.[colIdx] || 0;
        return (
          <div key={s} className="border-b border-l border-border relative" style={{ height: cellHeight }}>
            {showBadges && occ > 0 && (
              <div className={cn(
                'absolute top-0.5 left-0.5 right-0.5 rounded px-1 text-[9px] font-mono font-semibold text-center leading-tight z-20',
                occ >= capacity ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                  : occ >= capacity * 0.7 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-muted text-muted-foreground',
              )}>
                {occ}/{capacity}
              </div>
            )}
            {cellItems.map(({ booking: b, step, sessionColEnd, colEnd, lane, guests, children }, i) => {
              const sessionSpan = Math.max(1, sessionColEnd - colIdx);
              const bufferSpan = Math.max(0, colEnd - sessionColEnd);
              const top = (showBadges ? BADGE_STRIP : 2) + lane * LANE_HEIGHT;
              // Single-lane resources (the common case — everything except Salt
              // Cave) fill the whole cell like before; multi-lane rows keep each
              // card compact so several fit without overlapping.
              const itemHeight = laneCount === 1 ? cellHeight - top - 2 : LANE_HEIGHT - 4;
              // Absolute overlay stretches across `sessionSpan` columns using
              // inline style; `top` keeps simultaneous bookings on separate
              // lanes instead of overlapping. A second, lighter overlay
              // (bufferSpan) renders the room's post/cleaning buffer right
              // after it \u2014 still occupied, just not in-session \u2014 so the
              // calendar doesn't show a room as free before it actually is.
              return (
                <Fragment key={b.id + '-' + i}>
                  <Link href={`/admin/bookings/${b.id}`}
                    className={cn(
                      'absolute left-0.5 rounded-md px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden z-10',
                      statusClasses(b.status)
                    )}
                    style={{ width: `calc(${sessionSpan * 100}% - 4px)`, top, height: itemHeight }}
                    title={`${b.contact?.name || 'Guest'} \u00b7 ${step.therapyName || ''}${guests > 1 ? ` \u00b7 ${guests} guests` : ''}${children > 0 ? ` + ${children} child${children > 1 ? 'ren' : ''}` : ''}`}
                  >
                    <div className="font-semibold truncate">
                      {b.contact?.name || 'Guest'}{(guests > 1 || children > 0) && <span className="opacity-70"> {'\u00d7'}{guests}{children > 0 ? `+${children}` : ''}</span>}
                    </div>
                    <div className="opacity-80 truncate">{step.therapyName || '\u2014'}</div>
                    {/* Explicit start\u2013end, so the session's real boundary never
                        depends on eyeballing which grid column a rounded card
                        edge lands in \u2014 labels are center-aligned in their
                        column, which made a card ending exactly on a gridline
                        look like it stopped a column early. Only shown once
                        there's room for it (narrow single-column cards keep
                        just the tooltip). */}
                    {sessionSpan >= 2 && (
                      <div className="opacity-60 truncate font-mono text-[9px]">{istHHmm(step.from)}{'\u2013'}{istHHmm(step.to)}</div>
                    )}
                  </Link>
                  {bufferSpan > 0 && b.status !== 'cancelled' && (
                    <div
                      className="absolute rounded-md border border-dashed border-foreground/25 bg-foreground/5 z-[5] flex items-center justify-center"
                      style={{ left: `${sessionSpan * 100}%`, width: `calc(${bufferSpan * 100}% - 4px)`, top, height: itemHeight }}
                      title={`Room reset \u00b7 ${bufferSpan * SLOT_MIN} min buffer \u00b7 free from ${istHHmm(step.blockedTo)}`}
                    >
                      {bufferSpan >= 2 && (
                        <span className="text-[9px] font-mono text-muted-foreground truncate px-1">{'\u2192'}{istHHmm(step.blockedTo)}</span>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function statusClasses(s) {
  switch (s) {
    case 'checked_in': return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/30';
    case 'in_session': return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 ring-1 ring-purple-500/30';
    case 'completed':  return 'bg-muted text-muted-foreground ring-1 ring-border';
    case 'no_show':    return 'bg-red-500/15 text-red-800 dark:text-red-300 ring-1 ring-red-500/30';
    case 'cancelled':  return 'bg-red-500/10 text-red-700/70 dark:text-red-400/70 line-through ring-1 ring-red-500/20';
    default:           return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/30';
  }
}

function LegendDot({ cls, label }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-sm', cls)} /> {label}</span>;
}
