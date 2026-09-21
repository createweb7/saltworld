'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, LogIn, Play, Square, XCircle, UserX, Loader2 } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';

async function fetchBooking(id) {
  const res = await fetch(`/api/admin/bookings/${id}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

const ACTIONS = [
  { key: 'check-in', label: 'Check in',    icon: LogIn,   status: 'checked_in' },
  { key: 'start',    label: 'Start',       icon: Play,    status: 'in_session' },
  { key: 'complete', label: 'Complete',    icon: Check,   status: 'completed' },
  { key: 'no-show',  label: 'No-show',     icon: UserX,   status: 'no_show'   },
  { key: 'cancel',   label: 'Cancel',      icon: XCircle, status: 'cancelled' },
];

export default function BookingDetailClient({ user, id }) {
  const qc = useQueryClient();
  const { data: b, isLoading } = useQuery({ queryKey: ['booking', id], queryFn: () => fetchBooking(id) });

  const doAction = async (key) => {
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/${key}`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      toast.success(`Marked ${key.replace('-', ' ')}`);
      qc.invalidateQueries({ queryKey: ['booking', id] });
    } catch { toast.error('Could not update'); }
  };

  return (
    <AdminShell user={user} title={b ? `Booking ${b.ref}` : 'Booking'}
      actions={<Link href="/admin/bookings" className="h-8 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-muted"><ArrowLeft className="h-3 w-3" /> Bookings</Link>}
    >
      {isLoading && <div className="text-center py-16"><Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" /></div>}
      {b && (
        <>
          <PageHeader eyebrow="Booking" title={b.ref} subtitle={`${b.contact?.name || 'Guest'} · ${b.slotDate} · ${b.slotTime}`} />
          <AdminSection>
            <div className="grid md:grid-cols-3 gap-4">
              <Card label="Customer" items={[
                ['Name',  b.contact?.name],
                ['Phone', b.contact?.phone],
                ['Email', b.contact?.email],
              ]} />
              <Card label="Session" items={[
                ['Outcome', b.outcome],
                ['Therapy', b.therapy],
                ['Guests',  b.guests || 1],
                ...(b.children > 0 ? [['Children', b.children]] : []),
                ['Notes',   b.contact?.notes || '—'],
              ]} />
              <Card label="Payment" items={[
                ['Method', typeof b.payment === 'string' ? b.payment : b.payment?.method || '—'],
                ['Total',  b.total ? '₹' + b.total.toLocaleString('en-IN') : '—'],
                ['Status', b.status],
              ]} />
            </div>

            <div className="mt-6">
              <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Actions</div>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <button key={a.key} onClick={() => doAction(a.key)}
                    className={cn(
                      'h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors',
                      b.status === a.status && 'bg-muted text-muted-foreground pointer-events-none'
                    )}>
                    <a.icon className="h-3.5 w-3.5" /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </AdminSection>
        </>
      )}
    </AdminShell>
  );
}

function Card({ label, items }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{label}</div>
      <dl className="mt-3 space-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-start gap-3 text-[13px]">
            <dt className="w-20 text-muted-foreground">{k}</dt>
            <dd className="flex-1 min-w-0 font-medium">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
