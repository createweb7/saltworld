'use client';

import { useMemo, useState } from 'react';
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

/** Round HH:mm down to the nearest SLOT_MIN (used for column bucketing). */
function alignToSlot(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + Math.floor(m / SLOT_MIN) * SLOT_MIN;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Duration in slot-columns for an ISO from/to pair. */
function slotsBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return 1;
  const mins = Math.max(SLOT_MIN, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
  return Math.max(1, Math.round(mins / SLOT_MIN));
}

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

  // Bucket bookings by resource + slot-column. For journey bookings that traverse
  // multiple resources we walk `schedule[]` — each step lives on its own row.
  const grid = useMemo(() => {
    const map = {};
    for (const b of bookings) {
      const steps = Array.isArray(b.schedule) && b.schedule.length > 0
        ? b.schedule.map((s) => ({
            resourceId: s.resourceId,
            resourceName: s.resourceName,
            from: s.from,
            to: s.to,
            therapyName: s.therapyName || s.therapySlug || b.therapy || b.therapyLabel,
          }))
        : [{
            resourceId: b.resourceId,
            resourceName: b.resourceName,
            from: b.startAt || (b.slotDate && b.slotTime ? `${b.slotDate}T${b.slotTime}:00+05:30` : null),
            to: b.blockedTo || null,
            therapyName: b.therapyLabel || b.therapy || b.outcomeLabel || b.outcome,
          }];
      for (const step of steps) {
        if (!step.resourceId || !step.from) continue;
        const hhmm  = istHHmm(step.from);
        const align = alignToSlot(hhmm);
        if (!align) continue;
        const key = `${step.resourceId}__${align}`;
        (map[key] = map[key] || []).push({ booking: b, step });
      }
    }
    return map;
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
              {SLOTS.map((s) => (
                <div key={s} className={cn(
                  'border-b border-l border-border text-[10.5px] text-muted-foreground text-center py-2 font-mono',
                  s.endsWith(':00') ? 'text-foreground/70 font-semibold' : ''
                )}>{s}</div>
              ))}
              {resources.map((r) => (
                <FragmentRow key={r.id} r={r} grid={grid} />
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
        </div>
      </AdminSection>
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ */
/* Row + status                                                       */
/* ------------------------------------------------------------------ */

function FragmentRow({ r, grid }) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-card border-r border-b border-border px-3 py-3 text-[12.5px] font-medium truncate">{r.name}</div>
      {SLOTS.map((s) => {
        const cellKey = `${r.id}__${s}`;
        const cellItems = grid[cellKey] || [];
        return (
          <div key={cellKey} className="border-b border-l border-border h-14 relative">
            {cellItems.map(({ booking: b, step }, i) => {
              const span = slotsBetween(step.from, step.to);
              // Absolute overlay stretches across `span` columns using inline style.
              return (
                <Link key={b.id + '-' + i} href={`/admin/bookings/${b.id}`}
                  className={cn(
                    'absolute inset-y-0.5 left-0.5 rounded-md px-1.5 py-1 text-[10.5px] leading-tight overflow-hidden z-10',
                    statusClasses(b.status)
                  )}
                  style={{ width: `calc(${span * 100}% - 4px)` }}
                >
                  <div className="font-semibold truncate">{b.contact?.name || 'Guest'}</div>
                  <div className="opacity-80 truncate">{step.therapyName || '\u2014'}</div>
                </Link>
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
