'use client';

// Customer-facing Cancel / Reschedule for a single booking.
// Honours the server-side cancel/reschedule cutoff. If past cutoff, buttons
// are visible but disabled with an explanatory tooltip. If reschedule is
// attempted and the target slot is no longer available, we surface the
// server-returned suggestions inline.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { AlertTriangle, X, Calendar, Users, Loader2 } from 'lucide-react';
import RescheduleDialog from '@/components/booking/RescheduleDialog';

const IST_OFFSET_MIN = 330;

export default function BookingActions({ booking }) {
  const router = useRouter();
  const [rules, setRules]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen]         = useState(false);

  useEffect(() => {
    let ok = true;
    fetch('/api/booking-rules').then((r) => r.ok ? r.json() : null).then((d) => { if (ok) setRules(d); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  const cutoff = useMemo(() => {
    if (!booking?.startAt || !rules) return null;
    const start = new Date(booking.startAt);
    const istMs = start.getTime() + IST_OFFSET_MIN * 60000;
    const ist = new Date(istMs);
    const [h, m] = String(rules.cutoffTime || '21:00').split(':').map(Number);
    ist.setUTCDate(ist.getUTCDate() - Number(rules.cutoffDaysBefore || 1));
    ist.setUTCHours(h, m, 0, 0);
    return new Date(ist.getTime() - IST_OFFSET_MIN * 60000);
  }, [booking, rules]);

  const isPastCutoff = cutoff ? Date.now() > cutoff.getTime() : false;
  const isTerminal   = ['cancelled', 'completed', 'no_show', 'in_session'].includes(booking.status);
  const disabled     = isPastCutoff || isTerminal;

  const cutoffLabel = cutoff
    ? cutoff.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
    : null;

  if (isTerminal) {
    return (
      <div className="pt-3 border-t border-border text-[11.5px] text-muted-foreground">
        This booking is {booking.status.replace(/_/g, ' ')}.
      </div>
    );
  }

  return (
    <>
      <div className="pt-3 border-t border-border space-y-2">
        <button
          type="button"
          onClick={() => setRescheduleOpen(true)}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-border text-[12.5px] font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5" /> Reschedule
        </button>
        <button
          type="button"
          onClick={() => setCancelOpen(true)}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-transparent text-[12.5px] font-medium text-red-600 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          <X className="h-3.5 w-3.5" /> Cancel booking
        </button>
        {isPastCutoff && cutoffLabel && (
          <div className="text-[11px] text-muted-foreground pt-1 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Changes were allowed until <span className="font-mono">{cutoffLabel}</span>. Please call reception for exceptions.</span>
          </div>
        )}
        {!isPastCutoff && cutoffLabel && (
          <div className="text-[11px] text-muted-foreground pt-1">
            You can change until <span className="font-mono">{cutoffLabel}</span>.
          </div>
        )}
      </div>

      {cancelOpen && (
        <ConfirmCancel
          onClose={() => setCancelOpen(false)}
          onConfirmed={() => { setCancelOpen(false); router.refresh(); }}
          bookingId={booking.id}
        />
      )}
      {rescheduleOpen && (
        <RescheduleDialog
          booking={booking}
          basePath={`/api/bookings/${booking.id}`}
          onClose={() => setRescheduleOpen(false)}
          onSaved={() => { setRescheduleOpen(false); router.refresh(); }}
        />
      )}

      {!disabled && booking.sessionMode !== 'couple' && (
        <ConvertToCouple booking={booking} onConverted={() => router.refresh()} />
      )}
    </>
  );
}

// Solo -> Couple, same date/time, price difference charged online. Only
// shown when the booking is actually eligible (quote comes back positive) —
// e.g. no session-mode-priced therapy in the journey, or already Couple,
// quietly renders nothing.
function ConvertToCouple({ booking, onConverted }) {
  const [quote, setQuote] = useState(null); // { eligible, diffInr, newTotalInr }
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let ok = true;
    fetch(`/api/bookings/${booking.id}/session-mode-quote`)
      .then((r) => r.json())
      .then((d) => { if (ok) setQuote(d); })
      .catch(() => { if (ok) setQuote({ eligible: false }); });
    return () => { ok = false; };
  }, [booking.id]);

  const pay = async () => {
    setPaying(true); setErr(null);
    try {
      const orderRes = await fetch(`/api/bookings/${booking.id}/session-mode/order`, { method: 'POST' });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson.error || 'order_failed');
      if (typeof window.Razorpay !== 'function') throw new Error('checkout_not_ready');

      const rzp = new window.Razorpay({
        key: orderJson.keyId,
        amount: orderJson.order.amount,
        currency: orderJson.order.currency,
        order_id: orderJson.order.id,
        name: 'Salt World',
        description: 'Convert to Couple',
        theme: { color: '#0f4c3a' },
        handler: async (response) => {
          try {
            const res = await fetch(`/api/bookings/${booking.id}/session-mode/verify`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'verify_failed');
            onConverted();
          } catch (e) {
            setErr(e.message === 'conversion_failed_after_payment'
              ? 'Payment went through, but this slot can no longer run as Couple (e.g. no couple tank free at this time). Please call reception — your payment is on file and will be sorted out.'
              : 'Payment succeeded but we could not confirm the conversion. Please contact us with your payment ID.');
          } finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', () => { setErr('Payment failed. Please try again.'); setPaying(false); });
      rzp.open();
    } catch (e) {
      setErr('Could not start payment. Please try again in a moment.');
      setPaying(false);
    }
  };

  if (!quote?.eligible) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button
        type="button"
        onClick={pay}
        disabled={paying}
        className="h-9 w-full rounded-md border border-border text-[12.5px] font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
      >
        {paying ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</> : <><Users className="h-3.5 w-3.5" /> Add a partner — convert to Couple (+₹{quote.diffInr.toLocaleString('en-IN')})</>}
      </button>
      <div className="mt-1.5 text-[11px] text-muted-foreground">Same date & time — just pay the difference online.</div>
      {err && <div className="mt-2 text-[11.5px] text-red-600">{err}</div>}
    </div>
  );
}

function ConfirmCancel({ bookingId, onClose, onConfirmed }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'cancel_failed');
      onConfirmed();
    } catch (e) { setErr(String(e.message || 'Could not cancel')); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Cancel</div>
        <h2 className="mt-1 font-serif text-2xl">Cancel this booking?</h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
          The slot will be released and offered to other guests. You&rsquo;ll get a confirmation via SMS/WhatsApp.
        </p>
        <label className="block mt-4 text-[12px] font-medium">Reason (optional)</label>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background text-[13px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="Feeling unwell / travel plans / …" />
        {err && <div className="mt-3 text-[12px] text-red-600">{err}</div>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Keep booking</button>
          <button onClick={submit} disabled={busy} className="h-9 px-3 rounded-md text-[12.5px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
            {busy ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
