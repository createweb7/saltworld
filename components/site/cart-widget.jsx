'use client';

// Header "cart" affordance — always visible, like a normal e-commerce
// cart icon, so it reads as a stable part of the nav rather than a
// surprise. It only badges up when the signed-in customer has an unpaid
// booking (status: payment_pending), making that hold visible
// instead of it silently sitting there and colliding with the customer's
// next attempt as a confusing slot-conflict error — see the resume-
// payment flow this dropdown drives (reuses the SAME booking id for
// checkout, never creates a duplicate).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, X, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve();
    const existing = document.getElementById('razorpay-checkout-js');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load payment gateway.')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'razorpay-checkout-js';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load payment gateway.'));
    document.body.appendChild(s);
  });
}

export default function CartWidget({ inverted = false }) {
  const [pending, setPending] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  const refresh = () => {
    fetch('/api/bookings/pending')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setPending(d?.booking || null))
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
    // Re-check when the customer comes back to the tab — this is exactly
    // the "left mid-checkout, came back later" case the badge exists for.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const payNow = async () => {
    setBusy(true); setError(null);
    try {
      await loadRazorpayScript();
      const statusRes = await fetch('/api/payments/status').then((r) => r.json());
      if (!statusRes?.configured) throw new Error('Online payment is temporarily unavailable.');
      const co = await fetch('/api/payments/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: pending.id, amountPaise: Math.round((Number(pending.total) || 0) * 100), notes: { ref: pending.ref } }),
      });
      const coJson = await co.json();
      if (!co.ok) throw new Error(coJson?.error === 'booking_not_payable' ? 'This booking is no longer awaiting payment.' : 'Could not start payment.');
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: coJson.keyId || statusRes.keyId,
          amount: coJson.order.amount,
          currency: coJson.order.currency || 'INR',
          name: 'Salt World',
          description: `Booking ${pending.ref}`,
          order_id: coJson.order.id,
          prefill: {
            name: pending.contact?.name || '',
            email: pending.contact?.email || '',
            contact: pending.contact?.phone || '',
          },
          theme: { color: '#0a3838' },
          handler: async (response) => {
            try {
              const v = await fetch('/api/payments/verify-signature', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bookingId: pending.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const j = await v.json();
              if (!v.ok || !j?.success) return reject(new Error('Signature verification failed.'));
              resolve();
            } catch (e) { reject(e); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
        });
        rzp.open();
      });
      setPending(null);
      setOpen(false);
      window.location.assign(`/book/confirm/${pending.id}`);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bookings/${pending.id}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'removed_from_cart' }),
      });
      if (!r.ok) throw new Error('Could not remove.');
      setPending(null);
      setOpen(false);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={pending ? 'Unpaid booking in your cart' : 'Your cart'}
        className={cn(
          'relative inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors',
          inverted ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'
        )}
      >
        <ShoppingBag className="h-4 w-4" />
        {pending && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">1</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[300px] rounded-xl border border-border bg-background shadow-xl p-4 z-[70]">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
              {pending ? 'Awaiting payment' : 'Your cart'}
            </div>
            <button onClick={() => setOpen(false)} className="h-6 w-6 rounded-full hover:bg-muted inline-flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
          </div>

          {pending ? (
            <>
              <div className="mt-2 text-[14.5px] font-medium">{pending.outcomeLabel || pending.therapyLabel || 'Your booking'}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {pending.slotDate}{pending.slotTime ? ` · ${pending.slotTime}` : ''} · Ref {pending.ref}
              </div>
              <div className="mt-3 flex items-center justify-between text-[13.5px]">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">₹{Number(pending.total || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                <Clock className="h-3 w-3" /> This hold releases automatically if unpaid.
              </div>
              {error && <div className="mt-2 text-[12px] text-red-600">{error}</div>}
              <div className="mt-4 flex items-center gap-2">
                <button onClick={remove} disabled={busy} className="h-9 flex-1 rounded-md border border-border text-[12.5px] font-medium hover:bg-muted disabled:opacity-40">
                  Remove
                </button>
                <button onClick={payNow} disabled={busy} className="h-9 flex-1 rounded-md bg-foreground text-background text-[12.5px] font-semibold disabled:opacity-40">
                  {busy ? 'Working…' : 'Pay now'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                Nothing here yet. Start a booking and, if you don&rsquo;t finish paying, it&rsquo;ll wait for you right here.
              </p>
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="mt-4 h-9 w-full rounded-md bg-foreground text-background text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5"
              >
                Book a session <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
