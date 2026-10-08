'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, LogIn, Play, Square, XCircle, UserX, Loader2, Users, Calendar } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';
import RescheduleDialog from '@/components/booking/RescheduleDialog';

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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

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
                ['Mode',    b.sessionMode === 'couple' ? 'Couple' : b.sessionMode === 'single' ? 'Solo' : '—'],
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
                {!['cancelled', 'completed', 'no_show'].includes(b.status) && (
                  <button onClick={() => setRescheduleOpen(true)}
                    className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
                    <Calendar className="h-3.5 w-3.5" /> Reschedule
                  </button>
                )}
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

            {!['cancelled', 'completed', 'no_show'].includes(b.status) && b.sessionMode !== 'couple' && (
              <ConvertToCoupleAdmin booking={b} onConverted={() => qc.invalidateQueries({ queryKey: ['booking', id] })} />
            )}
          </AdminSection>

          {rescheduleOpen && (
            <RescheduleDialog
              booking={b}
              basePath={`/api/admin/bookings/${b.id}`}
              onClose={() => setRescheduleOpen(false)}
              onSaved={() => {
                setRescheduleOpen(false);
                toast.success('Booking rescheduled');
                qc.invalidateQueries({ queryKey: ['booking', id] });
              }}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

// Staff-side Solo -> Couple conversion — same date/time, price difference
// charged online (same quote/order/verify flow as the customer's account
// page; only the auth + endpoint prefix differ). Renders nothing when the
// booking isn't actually eligible (no session-mode-priced therapy, already
// Couple, or membership-covered).
function ConvertToCoupleAdmin({ booking, onConverted }) {
  const [quote, setQuote]   = useState(undefined); // undefined = loading
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let ok = true;
    fetch(`/api/admin/bookings/${booking.id}/session-mode-quote`)
      .then((r) => r.json())
      .then((d) => { if (ok) setQuote(d); })
      .catch(() => { if (ok) setQuote({ eligible: false }); });
    return () => { ok = false; };
  }, [booking.id]);

  const pay = async () => {
    setPaying(true);
    try {
      const orderRes = await fetch(`/api/admin/bookings/${booking.id}/session-mode/order`, { method: 'POST' });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson.error || 'order_failed');
      if (typeof window.Razorpay !== 'function') throw new Error('checkout_not_ready');

      const rzp = new window.Razorpay({
        key: orderJson.keyId,
        amount: orderJson.order.amount,
        currency: orderJson.order.currency,
        order_id: orderJson.order.id,
        name: 'Salt World',
        description: `Convert ${booking.ref} to Couple`,
        prefill: { name: booking.contact?.name || '', email: booking.contact?.email || '', contact: booking.contact?.phone || '' },
        theme: { color: '#0f4c3a' },
        handler: async (response) => {
          try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/session-mode/verify`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'verify_failed');
            toast.success('Converted to Couple');
            onConverted();
          } catch (e) {
            toast.error(e.message === 'conversion_failed_after_payment'
              ? 'Paid, but this slot can no longer run as Couple (e.g. no couple tank free). Resolve manually — payment is on file.'
              : 'Payment succeeded but activation failed — resolve manually with the payment ID.');
          } finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', () => { toast.error('Payment failed.'); setPaying(false); });
      rzp.open();
    } catch (e) {
      toast.error('Could not start payment.');
      setPaying(false);
    }
  };

  if (!quote?.eligible) return null;

  return (
    <div className="mt-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Convert to Couple</div>
      <button onClick={pay} disabled={paying}
        className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-40">
        {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
        {paying ? 'Processing…' : `Collect +₹${quote.diffInr.toLocaleString('en-IN')} & convert`}
      </button>
      <div className="mt-1.5 text-[11px] text-muted-foreground">Opens Razorpay Checkout for the price difference — same date & time.</div>
    </div>
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
