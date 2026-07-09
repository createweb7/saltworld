'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Loader2, ArrowLeft } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';

const RESOURCES = [
  { id: 'float_1', label: 'Float Tank 1',   type: 'float_tank' },
  { id: 'float_2', label: 'Float Tank 2',   type: 'float_tank' },
  { id: 'salt_1',  label: 'Salt Cave',      type: 'salt_cave'  },
  { id: 'sauna_1', label: 'Infrared Sauna', type: 'sauna'      },
  { id: 'plunge_1',label: 'Cold Plunge',    type: 'plunge'     },
  { id: 'red_1',   label: 'Red-light',      type: 'red_light'  },
];
const START_HOUR = 6;   // 06:00
const END_HOUR   = 21;  // 21:00
const SLOT_MIN   = 30;
const SLOTS = Array.from(
  { length: ((END_HOUR - START_HOUR) * 60) / SLOT_MIN },
  (_, i) => {
    const total = START_HOUR * 60 + i * SLOT_MIN;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
);

function fmtDate(d) { return d.toISOString().slice(0, 10); }

async function fetchCalendar(fromISO, toISO) {
  const res = await fetch(`/api/admin/bookings/calendar?from=${fromISO}&to=${toISO}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function CalendarClient({ user }) {
  const [date, setDate] = useState(new Date());
  const dayStart = useMemo(() => { const d = new Date(date); d.setHours(0,0,0,0); return d; }, [date]);
  const dayEnd   = useMemo(() => { const d = new Date(date); d.setHours(23,59,59,999); return d; }, [date]);

  const { data = [], isLoading } = useQuery({
    queryKey: ['calendar', fmtDate(dayStart)],
    queryFn: () => fetchCalendar(dayStart.toISOString(), dayEnd.toISOString()),
  });

  // Bucket bookings into resource + slot cells
  const grid = useMemo(() => {
    const map = {};
    for (const b of data) {
      const time = b.slotTime || (b.startAt ? new Date(b.startAt).toTimeString().slice(0, 5) : null);
      const resId = b.resourceId || guessResource(b);
      if (!time || !resId) continue;
      const key = `${resId}__${time}`;
      (map[key] = map[key] || []).push(b);
    }
    return map;
  }, [data]);

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
        title={date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
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
        {!isLoading && (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <div className="min-w-[900px] grid" style={{ gridTemplateColumns: `160px repeat(${SLOTS.length}, minmax(56px, 1fr))` }}>
              {/* Header row */}
              <div className="sticky left-0 z-10 bg-card border-r border-b border-border text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold px-3 py-2">Resource</div>
              {SLOTS.map((s) => (
                <div key={s} className="border-b border-l border-border text-[10.5px] text-muted-foreground text-center py-2 font-mono">{s}</div>
              ))}
              {RESOURCES.map((r) => (
                <FragmentRow key={r.id} r={r} grid={grid} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-[11.5px] text-muted-foreground">
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

function FragmentRow({ r, grid }) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-card border-r border-b border-border px-3 py-3 text-[12.5px] font-medium truncate">{r.label}</div>
      {SLOTS.map((s) => {
        const bookings = grid[`${r.id}__${s}`] || [];
        return (
          <div key={r.id + s} className="border-b border-l border-border h-14 relative">
            {bookings.map((b) => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`}
                className={cn(
                  'absolute inset-0.5 rounded-md px-1.5 py-1 text-[10.5px] leading-tight overflow-hidden',
                  statusClasses(b.status)
                )}>
                <div className="font-semibold truncate">{b.contact?.name || 'Guest'}</div>
                <div className="opacity-80 truncate">{b.therapy || b.outcome || '—'}</div>
              </Link>
            ))}
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

// Fallback: infer resource from therapy name if resourceId missing on the booking.
function guessResource(b) {
  const t = (b.therapy || '').toLowerCase();
  if (t.includes('float')) return 'float_1';
  if (t.includes('salt'))  return 'salt_1';
  if (t.includes('sauna')) return 'sauna_1';
  if (t.includes('cold') || t.includes('plunge')) return 'plunge_1';
  if (t.includes('red'))   return 'red_1';
  return 'float_1';
}
