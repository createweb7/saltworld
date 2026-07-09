'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Calendar as CalIcon, ArrowRight, Loader2, Filter } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';

const STATUSES = [
  { key: '',            label: 'All'         },
  { key: 'confirmed',   label: 'Confirmed'   },
  { key: 'checked_in',  label: 'Checked in'  },
  { key: 'in_session',  label: 'In session'  },
  { key: 'completed',   label: 'Completed'   },
  { key: 'no_show',     label: 'No-show'     },
  { key: 'cancelled',   label: 'Cancelled'   },
];

async function fetchBookings({ q, status }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const res = await fetch(`/api/admin/bookings?${params}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function BookingsClient({ user }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['bookings', q, status],
    queryFn: () => fetchBookings({ q, status }),
  });

  return (
    <AdminShell
      user={user}
      title="Bookings"
      actions={
        <Link href="/admin/bookings/calendar" className="h-8 px-3 rounded-md border border-border text-[12.5px] font-medium hover:bg-muted inline-flex items-center gap-1.5">
          <CalIcon className="h-3.5 w-3.5" /> Calendar
        </Link>
      }
    >
      <PageHeader eyebrow="Operations" title="Bookings" subtitle="Search, filter and open any booking." />
      <AdminSection>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref, name, phone…"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
            {STATUSES.map((s) => (
              <button key={s.key || 'all'} onClick={() => setStatus(s.key)}
                className={cn('h-7 px-2.5 rounded-[5px] text-[11.5px] font-medium transition-colors',
                  status === s.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="text-[12px] text-muted-foreground ml-auto">{data.length} result{data.length === 1 ? '' : 's'}</div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted/40">
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                <th className="px-4 py-2.5">Ref</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Therapy / Outcome</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" /></td></tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-[12.5px] text-muted-foreground">No bookings found.</td></tr>
              )}
              {data.map((b) => (
                <tr key={b.id || b.ref} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-[12.5px]">{b.ref}</td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-medium">{b.contact?.name || 'Guest'}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{b.contact?.phone || b.contact?.email || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted-foreground">{b.slotDate} · {b.slotTime}</td>
                  <td className="px-4 py-3 text-[12.5px]">{b.therapy || b.outcome || '—'}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">{b.total ? '₹' + b.total.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/bookings/${b.id || b.ref}`} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

function StatusPill({ status }) {
  const map = {
    confirmed:   ['Confirmed', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
    booked:      ['Booked',    'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
    checked_in:  ['Checked in','bg-amber-500/10 text-amber-700 dark:text-amber-400'],
    in_session:  ['In session','bg-purple-500/10 text-purple-700 dark:text-purple-400'],
    completed:   ['Done',      'bg-muted text-muted-foreground'],
    no_show:     ['No-show',   'bg-red-500/10 text-red-600 dark:text-red-400'],
    cancelled:   ['Cancelled', 'bg-muted text-muted-foreground'],
  };
  const [label, cls] = map[status] || ['—', 'bg-muted text-muted-foreground'];
  return <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold', cls)}>{label}</span>;
}
