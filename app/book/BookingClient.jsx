'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, Loader2, Clock, Calendar as Cal,
  MapPin, Phone, MessageCircle, Sparkles,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';
import { Wordmark } from '@/components/site/shell';
import { OUTCOMES, getOutcome } from '@/lib/outcomes';

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: 'outcome',  label: 'Outcome' },
  { id: 'therapy',  label: 'Therapy' },
  { id: 'slot',     label: 'Date & time' },
  { id: 'contact',  label: 'Confirm' },
];

const SESSION_TIMES = [
  { block: 'Morning',   times: ['07:00', '08:30', '10:00', '11:30'] },
  { block: 'Afternoon', times: ['13:00', '14:30', '16:00'] },
  { block: 'Evening',   times: ['17:30', '19:00', '20:30'] },
];

// Deterministic capacity so screenshots are stable.
function capacityFor(dateStr, time) {
  let h = 0;
  const s = dateStr + time;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h % 5; // 0–4 seats left
}

function fmtDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}
function toIsoDay(d) {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Header  — progress                                                 */
/* ------------------------------------------------------------------ */

function BookingHeader({ stepIdx, onBack, summary }) {
  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {stepIdx > 0 ? (
            <button onClick={onBack} aria-label="Back"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/" aria-label="Back to home"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="hidden md:block"><Wordmark /></div>
        </div>
        <div className="flex-1 md:hidden text-center text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
          {STEPS[stepIdx].label} · {stepIdx + 1}/{STEPS.length}
        </div>
        <div className="hidden md:flex items-center gap-3 text-[12px]">
          {STEPS.map((s, i) => (
            <div key={s.id} className={cn(
              'flex items-center gap-1.5',
              i === stepIdx ? 'text-foreground font-medium' : i < stepIdx ? 'text-brand' : 'text-muted-foreground'
            )}>
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                i === stepIdx ? 'bg-foreground text-background' : i < stepIdx ? 'bg-brand text-white' : 'bg-muted border border-border'
              )}>
                {i < stepIdx ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </div>
              <span>{s.label}</span>
              {i < STEPS.length - 1 && <span className="opacity-30 mx-1">—</span>}
            </div>
          ))}
        </div>
        <div className="w-9 md:hidden" />
      </div>
      <div className="h-0.5 bg-muted overflow-hidden">
        <div className="h-full bg-brand transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Outcome                                                   */
/* ------------------------------------------------------------------ */

function StepOutcome({ value, onChange }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 1 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        What brings you <span className="italic">here today?</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[540px]">
        Choose how you want to feel. We’ll match you with the right protocol on the next screen.
      </p>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OUTCOMES.map((o) => {
          const isSel = value === o.slug;
          return (
            <button key={o.slug} onClick={() => onChange(o.slug)}
              className={cn(
                'text-left rounded-2xl border p-5 flex items-start gap-4 transition-all',
                isSel ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:border-foreground/40'
              )}>
              <div className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0',
                isSel ? 'bg-brand text-white' : 'bg-brand/10 text-brand'
              )}>
                <o.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-serif text-[19px] leading-tight text-foreground">{o.title}</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground text-pretty">{o.eyebrow}</div>
              </div>
              <div className={cn(
                'mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                isSel ? 'border-brand bg-brand' : 'border-border'
              )}>
                {isSel && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Therapy                                                   */
/* ------------------------------------------------------------------ */

function StepTherapy({ outcome, value, onChange }) {
  const o = getOutcome(outcome);
  const therapies = o?.protocol?.therapies || [];
  const priceLine = o?.pricing?.single?.price + ' ' + (o?.pricing?.single?.period || '');
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 2 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        For {o?.title?.toLowerCase()}, <br className="hidden md:block" /><span className="italic">we recommend.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[560px]">
        Your therapist will confirm the exact protocol at check-in. Pick your primary session below.
      </p>
      <div className="mt-10 space-y-3">
        {therapies.map((t) => {
          const isSel = value === t.slug;
          return (
            <button key={t.slug} onClick={() => onChange(t.slug)}
              className={cn(
                'w-full text-left rounded-2xl border p-5 md:p-6 flex items-center gap-4 transition-all',
                isSel ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:border-foreground/40'
              )}>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-serif text-[22px] md:text-[26px] leading-tight text-foreground">{t.label}</div>
                  <span className={cn(
                    'text-[10.5px] uppercase tracking-[0.16em] font-semibold',
                    isSel ? 'text-brand' : 'text-muted-foreground'
                  )}>{t.role}</span>
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">{o?.protocol?.duration} · {priceLine}</div>
              </div>
              <div className={cn(
                'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                isSel ? 'border-brand bg-brand' : 'border-border'
              )}>
                {isSel && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Slot                                                      */
/* ------------------------------------------------------------------ */

function StepSlot({ value, onChange }) {
  const days = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return d;
    });
  }, []);
  const [date, setDate] = useState(value?.date || toIsoDay(days[0]));

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 3 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        Pick a <span className="italic">quiet hour.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[560px]">
        Sessions run seven days a week. Evenings often fill three days ahead.
      </p>

      <div className="mt-8 -mx-4 md:mx-0">
        <div className="flex gap-2 overflow-x-auto px-4 md:px-0 no-scrollbar pb-2">
          {days.map((d) => {
            const iso = toIsoDay(d);
            const isSel = date === iso;
            return (
              <button key={iso} onClick={() => setDate(iso)}
                className={cn(
                  'shrink-0 w-[86px] rounded-2xl border py-3 flex flex-col items-center transition-all',
                  isSel ? 'border-brand bg-brand-soft text-foreground' : 'border-border bg-card hover:border-foreground/40'
                )}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                <div className={cn('mt-1 font-serif text-[24px] leading-none', isSel && 'text-brand')}>{d.getDate()}</div>
                <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {SESSION_TIMES.map((group) => (
          <div key={group.block}>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">{group.block}</div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {group.times.map((t) => {
                const cap = capacityFor(date, t);
                const full = cap === 0;
                const isSel = value?.date === date && value?.time === t;
                return (
                  <button key={t} disabled={full}
                    onClick={() => onChange({ date, time: t })}
                    className={cn(
                      'rounded-xl border py-3 px-2 flex flex-col items-center transition-all',
                      full && 'opacity-40 cursor-not-allowed',
                      isSel ? 'border-brand bg-brand text-white'
                            : 'border-border bg-card hover:border-foreground/40'
                    )}>
                    <div className="font-mono text-[14px] font-semibold tracking-tight">{t}</div>
                    <div className={cn('text-[10.5px] mt-0.5', isSel ? 'text-white/80' : 'text-muted-foreground')}>
                      {full ? 'Full' : cap === 1 ? '1 seat left' : `${cap} seats`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Contact & confirm                                         */
/* ------------------------------------------------------------------ */

function StepContact({ outcome, therapy, slot, contact, setContact, payment, setPayment, submitting, onSubmit, error, canPayOnline }) {
  const o = getOutcome(outcome);
  const th = o?.protocol?.therapies?.find((x) => x.slug === therapy);
  const priceLine = o?.pricing?.single?.price + ' ' + (o?.pricing?.single?.period || '');
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 4 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        A few details, <span className="italic">then you’re booked.</span>
      </h1>

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="name" className="block text-[12px] font-medium mb-1.5">Full name<span className="text-destructive ml-0.5">*</span></label>
              <input id="name" type="text" required minLength={2}
                value={contact.name || ''} onChange={(e) => setContact({ ...contact, name: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-[12px] font-medium mb-1.5">Phone<span className="text-destructive ml-0.5">*</span></label>
              <input id="phone" type="tel" required pattern="^[0-9+\-\s]{7,15}$"
                value={contact.phone || ''} onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="+91 …"
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-[12px] font-medium mb-1.5">Email <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input id="email" type="email"
              value={contact.email || ''} onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>
          <div>
            <label htmlFor="notes" className="block text-[12px] font-medium mb-1.5">Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea id="notes" rows={3}
              value={contact.notes || ''} onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-[14px] leading-6 focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>

          <div>
            <div className="text-[12px] font-medium mb-2">Payment</div>
            <div className="space-y-2">
              <label className={cn('flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer',
                payment === 'at-visit' ? 'border-brand bg-brand-soft' : 'border-border')}>
                <input type="radio" name="pay" checked={payment === 'at-visit'} onChange={() => setPayment('at-visit')} className="sr-only" />
                <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center', payment === 'at-visit' ? 'border-brand' : 'border-border')}>
                  {payment === 'at-visit' && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-medium">Pay at visit</div>
                  <div className="text-[12px] text-muted-foreground">Card / UPI at reception. Nothing charged now.</div>
                </div>
              </label>
              <label className={cn('flex items-center gap-3 rounded-xl border p-3.5',
                canPayOnline ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed',
                payment === 'online' ? 'border-brand bg-brand-soft' : 'border-border')}>
                <input type="radio" name="pay" disabled={!canPayOnline} checked={payment === 'online'} onChange={() => setPayment('online')} className="sr-only" />
                <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center', payment === 'online' ? 'border-brand' : 'border-border')}>
                  {payment === 'online' && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-medium flex items-center gap-2">
                    Pay online
                    {!canPayOnline && <span className="text-[10px] uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded">Soon</span>}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {canPayOnline ? 'Cards, UPI, netbanking via Razorpay. Secure by default.' : 'Available once payments are enabled.'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-[13px] px-3 py-2">{error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background text-[14.5px] font-semibold hover:bg-foreground/90 disabled:opacity-60 transition-colors">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {payment === 'online' ? 'Opening secure checkout…' : 'Confirming…'}</> : <>{payment === 'online' ? 'Pay & confirm booking' : 'Confirm booking'} <ArrowRight className="h-4 w-4" /></>}
          </button>
          <div className="text-[11.5px] text-muted-foreground text-center">
            By confirming, you agree to our <Link href="/legal/terms" className="underline underline-offset-2">terms</Link> &amp; <Link href="/legal/refunds" className="underline underline-offset-2">refund policy</Link>.
          </div>
        </form>

        {/* Summary card */}
        <aside className="rounded-2xl border border-border bg-card p-5 md:p-6 h-fit md:sticky md:top-24">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Your booking</div>
          <div className="mt-3 space-y-3 text-[13.5px]">
            <Row label="Outcome" value={o?.title} />
            <Row label="Therapy" value={th?.label} />
            <Row label="Date"    value={slot ? new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }) : '—'} />
            <Row label="Time"    value={slot?.time || '—'} />
            <Row label="Duration" value={o?.protocol?.duration || '—'} />
          </div>
          <div className="mt-5 pt-4 border-t border-border flex items-baseline justify-between">
            <span className="text-[12.5px] text-muted-foreground">Total (est.)</span>
            <span className="font-serif text-[28px] tracking-tight">{o?.pricing?.single?.price}</span>
          </div>
          <div className="mt-4 flex items-start gap-2 text-[11.5px] text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Salt World, HSR Layout, Bengaluru 560102</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value || '—'}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Client root                                                        */
/* ------------------------------------------------------------------ */

export default function BookingClient({ initialOutcome }) {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(initialOutcome ? 1 : 0);
  const [outcome, setOutcome] = useState(initialOutcome);
  const [therapy, setTherapy] = useState(null);
  const [slot, setSlot] = useState(null);
  const [contact, setContact] = useState({});
  const [payment, setPayment] = useState('at-visit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [payCfg, setPayCfg] = useState({ configured: false, keyId: null });

  // Auto-select first therapy when outcome changes.
  useEffect(() => {
    if (outcome && !therapy) {
      const o = getOutcome(outcome);
      setTherapy(o?.protocol?.therapies?.[0]?.slug || null);
    }
  }, [outcome, therapy]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [stepIdx]);

  // Fetch payment configuration once — we only surface "Pay online" if Razorpay is truly configured.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/status').then((r) => r.json()).then((d) => {
      if (!cancelled && d?.configured) setPayCfg({ configured: true, keyId: d.keyId });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const canNext =
    (stepIdx === 0 && !!outcome) ||
    (stepIdx === 1 && !!therapy) ||
    (stepIdx === 2 && !!slot?.date && !!slot?.time) ||
    stepIdx === 3;

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const openRazorpay = ({ order, keyId, bookingId, bookingRef, name, contact }) => new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.Razorpay === 'undefined') {
      reject(new Error('Payment gateway not ready. Please refresh and try again.'));
      return;
    }
    const rzp = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Salt World',
      description: `Booking ${bookingRef}`,
      order_id: order.id,
      prefill: {
        name: contact?.name || '',
        email: contact?.email || '',
        contact: contact?.phone || '',
      },
      theme: { color: '#0a3838' },
      handler: async (response) => {
        try {
          const v = await fetch('/api/payments/verify-signature', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const j = await v.json();
          if (!v.ok || !j?.success) return reject(new Error('Signature verification failed.'));
          resolve({ ok: true });
        } catch (e) { reject(e); }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    });
    rzp.open();
  });

  const submit = async () => {
    setError(null);
    if (!contact.name || !contact.phone) { setError('Name and phone are required.'); return; }
    setSubmitting(true);
    try {
      const o = getOutcome(outcome);
      const th = o?.protocol?.therapies?.find((x) => x.slug === therapy);
      const totalRupees = Number(String(o?.pricing?.single?.price || '0').replace(/[^\d]/g, ''));

      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome, outcomeLabel: o?.title, therapy, therapyLabel: th?.label,
          slotDate: slot.date, slotTime: slot.time,
          duration: o?.protocol?.duration,
          contact, payment,
          priceLine: o?.pricing?.single?.price + ' ' + (o?.pricing?.single?.period || ''),
          total: totalRupees,
        }),
      });
      if (!r.ok) throw new Error('Failed to create booking');
      const doc = await r.json();

      // If online payment requested and Razorpay is configured, open Checkout.
      if (payment === 'online' && payCfg.configured && totalRupees > 0) {
        const co = await fetch('/api/payments/create-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: doc.id, amountPaise: Math.round(totalRupees * 100), notes: { ref: doc.ref } }),
        });
        const coJson = await co.json();
        if (!co.ok) throw new Error(coJson?.error || 'Could not initialise payment.');
        await openRazorpay({
          order: coJson.order,
          keyId: coJson.keyId || payCfg.keyId,
          bookingId: doc.id,
          bookingRef: doc.ref,
          contact,
        });
      }

      router.push(`/book/confirm/${doc.id}`);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {payCfg.configured && (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      )}
      <BookingHeader stepIdx={stepIdx} onBack={back} />

      <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-28 md:pb-16">
        {stepIdx === 0 && <StepOutcome value={outcome} onChange={(v) => { setOutcome(v); setTherapy(null); }} />}
        {stepIdx === 1 && <StepTherapy outcome={outcome} value={therapy} onChange={setTherapy} />}
        {stepIdx === 2 && <StepSlot value={slot} onChange={setSlot} />}
        {stepIdx === 3 && (
          <StepContact
            outcome={outcome} therapy={therapy} slot={slot}
            contact={contact} setContact={setContact}
            payment={payment} setPayment={setPayment}
            canPayOnline={payCfg.configured}
            submitting={submitting} error={error} onSubmit={submit}
          />
        )}
      </main>

      {/* Sticky footer with primary action (steps 1–3 only; step 4 has its own submit) */}
      {stepIdx < 3 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
            <div className="hidden md:block text-[12.5px] text-muted-foreground">
              {stepIdx === 0 && (outcome ? `→ ${getOutcome(outcome)?.title}` : 'Choose the outcome you want')}
              {stepIdx === 1 && (therapy ? `→ ${getOutcome(outcome)?.protocol?.therapies?.find((x) => x.slug === therapy)?.label}` : 'Choose your primary therapy')}
              {stepIdx === 2 && (slot ? `→ ${new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} at ${slot.time}` : 'Pick a date and time')}
            </div>
            <button onClick={next} disabled={!canNext}
              className="ml-auto inline-flex items-center gap-2 h-11 px-6 rounded-full bg-foreground text-background text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-foreground/90 transition-colors">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
