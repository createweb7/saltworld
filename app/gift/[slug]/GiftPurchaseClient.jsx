'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ArrowRight, Loader2, Sparkles, User, Users } from 'lucide-react';
import GiftCardPreview from '@/components/site/gift-card-preview';
import OccasionPicker from '@/components/site/occasion-picker';
import { GIFT_DESIGNS } from '@/lib/gift-designs';
import { cn } from '@/components/ss/utils';

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

export default function GiftPurchaseClient({ outcome, therapies, therapyMeta }) {
  const router = useRouter();
  const primarySlug = therapies.find((t) => /primary/i.test(t.role || ''))?.slug || therapies[0]?.slug;
  const [selected, setSelected] = useState(primarySlug ? [primarySlug] : []);
  const [guests, setGuests] = useState(1);
  const [designId, setDesignId] = useState('halite');
  const [occasion, setOccasion] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [toName, setToName] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [message, setMessage] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    fetch('/api/customer/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setCustomer(d?.customer || null);
        if (d?.customer?.name) setFromName(d.customer.name);
        if (d?.customer?.phone) setFromPhone(d.customer.phone);
        if (d?.customer?.email) setFromEmail(d.customer.email);
      })
      .finally(() => setCustomerLoaded(true));
  }, []);

  const canGoCouple = selected.some((slug) => (therapyMeta[slug]?.maxCapacity || 1) > 1);
  useEffect(() => { if (!canGoCouple && guests > 1) setGuests(1); }, [canGoCouple, guests]);

  // Live price, quoted the same way a real booking would be — matches what
  // the recipient's eventual booking will actually cost. Mirrors the quote
  // request BookingClient sends (session mode + float duration per
  // therapy) — omitting these silently falls back to solo/60min pricing in
  // the pricing engine for Float/Sauna/Red Light/Cold Plunge, understating
  // the total whenever Couple is selected.
  const sessionMode = guests > 1 ? 'couple' : 'single';
  const floatDurationMin = outcome?.slug === 'couple-activities' ? 90 : 60;
  useEffect(() => {
    if (selected.length === 0) { setAmount(0); return; }
    let cancelled = false;
    setQuoting(true);
    fetch('/api/pricing/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapies: selected.map((slug) => ({
          slug,
          sessionMode: Array.isArray(therapyMeta[slug]?.durationOptions) && therapyMeta[slug].durationOptions.length > 0 ? sessionMode : undefined,
          durationMin: String(slug).includes('float') ? floatDurationMin : undefined,
        })),
        guests,
      }),
    })
      .then((r) => r.json())
      .then((q) => { if (!cancelled) setAmount(Math.round(q.payableInr || 0)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [selected, guests]);

  const toggle = (slug) => {
    setSelected((cur) => {
      const set = new Set(cur);
      if (set.has(slug)) { if (set.size > 1) set.delete(slug); }
      else set.add(slug);
      return therapies.filter((t) => set.has(t.slug)).map((t) => t.slug);
    });
    setFieldErrors((e) => ({ ...e, therapies: undefined }));
  };

  const selectedLabel = useMemo(() => {
    const picked = therapies.filter((t) => selected.includes(t.slug));
    return picked.length === 1 ? picked[0].label : `${picked.length} therapies`;
  }, [selected, therapies]);

  const validate = () => {
    const errs = {};
    if (!fromName.trim()) errs.fromName = 'Enter your name';
    if (!fromEmail.trim()) errs.fromEmail = 'Enter your email';
    else if (!/^\S+@\S+\.\S+$/.test(fromEmail.trim())) errs.fromEmail = 'Enter a valid email';
    if (!fromPhone.trim()) errs.fromPhone = 'Enter your phone';
    if (selected.length === 0) errs.therapies = 'Pick at least one therapy';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const pay = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await loadRazorpayScript();
      const statusRes = await fetch('/api/payments/status').then((r) => r.json());
      if (!statusRes?.configured) throw new Error('Online payment is temporarily unavailable.');

      const createRes = await fetch('/api/gifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'experience', outcomeSlug: outcome.slug, therapies: selected, guests,
          designId, occasion,
          from: { name: fromName, phone: fromPhone, email: fromEmail },
          to: { name: toName, email: toEmail, phone: toPhone },
          message,
        }),
      });
      const gift = await createRes.json();
      if (!createRes.ok) throw new Error(gift?.message || 'Could not create your gift.');

      const co = await fetch('/api/payments/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftCardId: gift.id, amountPaise: Math.round(gift.amount * 100), notes: { code: gift.code } }),
      });
      const coJson = await co.json();
      if (!co.ok) throw new Error('Could not start payment.');

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: coJson.keyId || statusRes.keyId,
          amount: coJson.order.amount,
          currency: coJson.order.currency || 'INR',
          name: 'Salt World',
          description: `Gift — ${outcome.title} (${selectedLabel})`,
          order_id: coJson.order.id,
          prefill: { name: fromName, contact: fromPhone, email: fromEmail || customer?.email || '' },
          theme: { color: '#0a3838' },
          handler: async (response) => {
            try {
              const v = await fetch('/api/payments/verify-signature', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  giftCardId: gift.id,
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

      router.push(`/account/gifts/${gift.id}`);
    } catch (e) {
      toast.error(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div className="mt-12 grid md:grid-cols-2 gap-10 md:gap-14">
      <div className="space-y-8 order-2 md:order-1 pb-20 md:pb-0">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Pick one therapy, or combine several</div>
          <div className="space-y-2.5">
            {therapies.map((t) => {
              const isSel = selected.includes(t.slug);
              const meta = therapyMeta[t.slug];
              const duration = meta?.durationMin || 45;
              return (
                <button key={t.slug} onClick={() => toggle(t.slug)} type="button"
                  className={cn('w-full text-left rounded-xl border-2 p-4 flex items-center justify-between gap-4 transition-colors',
                    isSel ? 'border-brand bg-brand-soft' : 'border-border hover:border-foreground/30')}>
                  <div>
                    <div className="text-[15px] font-serif">{t.label} <span className="text-[10.5px] font-sans uppercase tracking-[0.14em] text-muted-foreground align-middle ml-1">{t.role}</span></div>
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">{duration} min</div>
                  </div>
                  <div className={cn('h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0', isSel ? 'border-brand bg-brand' : 'border-border')}>
                    {isSel && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
          {fieldErrors.therapies && <div className="mt-2 text-[12px] text-destructive">{fieldErrors.therapies}</div>}
        </div>

        {canGoCouple && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Solo or couple</div>
            <div className="flex gap-2">
              <button onClick={() => setGuests(1)} type="button"
                className={cn('flex-1 h-11 rounded-full border-2 text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                  guests === 1 ? 'border-brand bg-brand-soft' : 'border-border hover:border-foreground/30')}>
                <User className="h-3.5 w-3.5" /> Solo
              </button>
              <button onClick={() => setGuests(2)} type="button"
                className={cn('flex-1 h-11 rounded-full border-2 text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                  guests === 2 ? 'border-brand bg-brand-soft' : 'border-border hover:border-foreground/30')}>
                <Users className="h-3.5 w-3.5" /> Couple
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Design</div>
          <div className="grid grid-cols-3 gap-2">
            {GIFT_DESIGNS.map((d) => (
              <button key={d.id} onClick={() => setDesignId(d.id)} type="button"
                className={cn('rounded-lg border-2 p-2 text-left transition-colors', designId === d.id ? 'border-foreground' : 'border-transparent hover:border-border')}>
                <div className="h-10 rounded-md" style={{ background: d.palette.bg }} />
                <div className="mt-1.5 text-[11px] font-medium">{d.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Occasion (optional)</div>
          <OccasionPicker value={occasion} onChange={setOccasion} />
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Your details</div>
          <div className="grid sm:grid-cols-3 gap-3 items-start">
            <FieldInput value={fromName} onChange={(v) => { setFromName(v); setFieldErrors((e) => ({ ...e, fromName: undefined })); }} placeholder="Name" error={fieldErrors.fromName} />
            <FieldInput value={fromEmail} onChange={(v) => { setFromEmail(v); setFieldErrors((e) => ({ ...e, fromEmail: undefined })); }} placeholder="Email" error={fieldErrors.fromEmail} />
            <FieldInput value={fromPhone} onChange={(v) => { setFromPhone(v); setFieldErrors((e) => ({ ...e, fromPhone: undefined })); }} placeholder="Phone" error={fieldErrors.fromPhone} />
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            Recipient <span className="normal-case font-normal text-muted-foreground/80">— optional, add it now or surprise them later from your account</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Their name" className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="Their email" className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={toPhone} onChange={(e) => setToPhone(e.target.value)} placeholder="Their phone" className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Message (optional)</div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="A note to go with the gift"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>
      </div>

      <div className="order-1 md:order-2 md:sticky md:top-28 h-fit">
        <GiftCardPreview designId={designId} amount={amount} experienceTitle={outcome.title}
          includesLabel={`${therapies.filter((t) => selected.includes(t.slug)).map((t) => t.label).join(' + ')}${guests > 1 ? ' · Couple' : ''}`}
          to={toName} from={fromName} message={message} occasion={occasion} size="lg" />
        <div className="hidden md:block mt-6 rounded-2xl border border-border bg-card p-5">
          <PriceAndPay amount={amount} quoting={quoting} customerLoaded={customerLoaded} customer={customer} outcomeSlug={outcome.slug} busy={busy} pay={pay} />
        </div>
      </div>
    </div>

    {/* Mobile-only: total + pay always reachable without scrolling back up
        past the whole form, mirroring the site's sticky mobile booking bar. */}
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2">
      <div className="rounded-2xl shadow-xl p-4" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
        <PriceAndPay amount={amount} quoting={quoting} customerLoaded={customerLoaded} customer={customer} outcomeSlug={outcome.slug} busy={busy} pay={pay} compact />
      </div>
    </div>
    </>
  );
}

function PriceAndPay({ amount, quoting, customerLoaded, customer, outcomeSlug, busy, pay, compact }) {
  return (
    <>
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-muted-foreground">Total</span>
        <span className="font-serif text-[24px]">{quoting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : `₹${amount.toLocaleString('en-IN')}`}</span>
      </div>
      {customerLoaded && !customer ? (
        <Link href={`/account/login?next=${encodeURIComponent(`/gift/${outcomeSlug}`)}`}
          className="mt-3 w-full h-11 rounded-full bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5">
          Sign in to continue <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <button onClick={pay} disabled={busy || !customerLoaded || amount <= 0}
          className="mt-3 w-full h-11 rounded-full bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</> : <><Sparkles className="h-3.5 w-3.5" /> Pay & create gift</>}
        </button>
      )}
      {!compact && (
        <div className="mt-3 flex items-start gap-2 text-[11.5px] text-muted-foreground">
          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand" /> Valid 12 months, redeemable at booking for this exact selection.
        </div>
      )}
    </>
  );
}

function FieldInput({ value, onChange, placeholder, error }) {
  return (
    <div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={cn('w-full h-11 px-3.5 rounded-full border bg-background text-[13.5px] focus:outline-none focus:ring-2',
          error ? 'border-destructive focus:ring-destructive/40' : 'border-border focus:ring-ring')} />
      {error && <div className="mt-1 ml-1 text-[11.5px] text-destructive">{error}</div>}
    </div>
  );
}
