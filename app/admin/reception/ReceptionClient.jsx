'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LogIn, Play, Check, XCircle, IndianRupee, Loader2, Phone, MessageCircle,
  ClipboardList, ArrowRight,
} from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';

async function fetchQueue() {
  const res = await fetch('/api/admin/bookings?');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function ReceptionClient({ user }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['reception'], queryFn: fetchQueue, refetchInterval: 15_000 });
  const [selectedId, setSelectedId] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = data.filter((b) => (b.slotDate || '').startsWith(today));
  const buckets = {
    incoming:   todayBookings.filter((b) => ['confirmed', 'booked'].includes(b.status)),
    checkedIn:  todayBookings.filter((b) => b.status === 'checked_in'),
    inSession:  todayBookings.filter((b) => b.status === 'in_session'),
    completed:  todayBookings.filter((b) => b.status === 'completed'),
  };
  const selected = todayBookings.find((b) => b.id === selectedId) || null;

  const doAction = async (b, key) => {
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/${key}`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['reception'] });
    } catch { toast.error('Could not update'); }
  };

  return (
    <AdminShell user={user} title="Reception" actions={
      <Link href="/admin/bookings" className="h-8 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-muted">
        All bookings <ArrowRight className="h-3 w-3" />
      </Link>
    }>
      <PageHeader eyebrow="Live desk" title="Reception desk" subtitle={"Today\u2019s queue. Click a customer to check them in, start the session, or collect payment."} />
      <AdminSection>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Queue */}
          <div className="xl:col-span-2 space-y-3">
            {isLoading && <div className="text-center py-16"><Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" /></div>}
            <Column label="Incoming" items={buckets.incoming}         hint="Not yet arrived" onSelect={setSelectedId} selectedId={selectedId} />
            <Column label="Checked in" items={buckets.checkedIn}      hint="Ready to start"   onSelect={setSelectedId} selectedId={selectedId} />
            <Column label="In session" items={buckets.inSession}      hint="Timer running"    onSelect={setSelectedId} selectedId={selectedId} />
            <Column label="Completed today" items={buckets.completed}  hint="Ready for POS"    onSelect={setSelectedId} selectedId={selectedId} />
          </div>

          {/* POS panel */}
          <div className="rounded-lg border border-border bg-card p-4 h-fit sticky top-20">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">POS panel</div>
            {!selected && <div className="mt-4 text-[12.5px] text-muted-foreground">Select a customer from the queue.</div>}
            {selected && (
              <>
                <div className="mt-3">
                  <div className="text-[16px] font-semibold">{selected.contact?.name || 'Guest'}</div>
                  <div className="text-[11.5px] text-muted-foreground">{selected.ref} · {selected.therapy || selected.outcome}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionBtn onClick={() => doAction(selected, 'check-in')} disabled={['checked_in','in_session','completed'].includes(selected.status)} icon={LogIn}   label="Check in" />
                  <ActionBtn onClick={() => doAction(selected, 'start')}    disabled={['in_session','completed'].includes(selected.status)}               icon={Play}    label="Start" />
                  <ActionBtn onClick={() => doAction(selected, 'complete')} disabled={selected.status === 'completed'}                                    icon={Check}   label="Complete" />
                  <ActionBtn onClick={() => doAction(selected, 'no-show')}  disabled={selected.status === 'completed'}                                    icon={XCircle} label="No-show" variant="danger" />
                </div>

                <div className="mt-5 pt-4 border-t border-border">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Payment</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <div className="font-serif text-[30px] leading-none tracking-tight">₹{(selected.total || 0).toLocaleString('en-IN')}</div>
                    <div className="text-[11.5px] text-muted-foreground">total</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {['Cash', 'UPI', 'Card', 'Wallet'].map((m) => (
                      <button key={m} className="h-9 rounded-md border border-border text-[12.5px] font-medium hover:bg-muted">{m}</button>
                    ))}
                  </div>
                  <button className="mt-3 w-full h-10 rounded-md bg-foreground text-background text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
                    <IndianRupee className="h-3.5 w-3.5" /> Collect &amp; issue invoice
                  </button>
                  <div className="mt-3 text-[11px] text-muted-foreground">Split payment, membership redemption and gift-card redeem arrive in Phase 3.2.</div>
                </div>

                {selected.contact?.phone && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                    <a href={`tel:${selected.contact.phone}`} className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center gap-1.5 hover:bg-muted"><Phone className="h-3 w-3" /> Call</a>
                    <a href={`https://wa.me/${selected.contact.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center gap-1.5 hover:bg-muted"><MessageCircle className="h-3 w-3" /> WhatsApp</a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

function Column({ label, hint, items, onSelect, selectedId }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold">{label}</div>
          <div className="text-[10.5px] text-muted-foreground">{hint}</div>
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{items.length}</div>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">Nothing here.</div>}
        {items.map((b) => (
          <button key={b.id} onClick={() => onSelect(b.id)}
            className={cn('w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors',
              selectedId === b.id && 'bg-muted')}>
            <div className="h-8 w-8 rounded-full bg-foreground text-background text-[11px] font-semibold flex items-center justify-center shrink-0">
              {(b.contact?.name || 'G').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{b.contact?.name || 'Guest'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{b.slotTime} · {b.therapy || b.outcome}{b.resourceName ? ` · ${b.resourceName}` : ''}</div>
            </div>
            <div className="text-[11.5px] font-mono text-muted-foreground">{b.ref}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, disabled, icon: Icon, label, variant }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn(
        'h-9 px-3 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none transition-colors',
        variant === 'danger'
          ? 'border border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/10'
          : 'border border-border hover:bg-muted'
      )}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
