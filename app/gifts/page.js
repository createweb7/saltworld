'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Check, Gift, Sparkles, Loader2 } from 'lucide-react';
import { TopNav, SiteFooter, WhatsAppFab } from '@/components/site/shell';
import GiftCardPreview from '@/components/site/gift-card-preview';
import OccasionPicker from '@/components/site/occasion-picker';
import { GIFT_DESIGNS, DENOMINATIONS, MIN_GIFT_AMOUNT, formatINR } from '@/lib/gift-designs';
import { OUTCOMES } from '@/lib/outcomes';
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

const GIFTABLE_OUTCOMES = OUTCOMES.filter((o) =>
  [o.pricing?.single, o.pricing?.pack, o.pricing?.membership].some((t) => t && Number(String(t.price).replace(/[^\d]/g, '')) > 0)
);

export default function GiftsPage() {
  const router = useRouter();
  const [designId, setDesignId] = useState('halite');
  const [amount, setAmount] = useState(5000);
  const [customAmount, setCustomAmount] = useState('');
  const [occasion, setOccasion] = useState('Birthday');
  const [toName, setToName] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [message, setMessage] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const effectiveAmount = customAmount ? Number(customAmount) : amount;

  const validate = () => {
    const errs = {};
    if (!fromName.trim()) errs.fromName = 'Enter your name';
    if (!fromEmail.trim()) errs.fromEmail = 'Enter your email';
    else if (!/^\S+@\S+\.\S+$/.test(fromEmail.trim())) errs.fromEmail = 'Enter a valid email';
    if (!fromPhone.trim()) errs.fromPhone = 'Enter your phone';
    if (!effectiveAmount || effectiveAmount < MIN_GIFT_AMOUNT) errs.amount = `Minimum ${formatINR(MIN_GIFT_AMOUNT)}`;
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
          kind: 'cash', amount: effectiveAmount, designId, occasion,
          from: { name: fromName, phone: fromPhone, email: fromEmail },
          to: { name: toName, email: toEmail, phone: toPhone },
          message,
        }),
      });
      const gift = await createRes.json();
      if (!createRes.ok) throw new Error(gift?.message || 'Could not create your gift.');

      const co = await fetch('/api/payments/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftCardId: gift.id, amountPaise: Math.round(effectiveAmount * 100), notes: { code: gift.code } }),
      });
      const coJson = await co.json();
      if (!co.ok) throw new Error('Could not start payment.');

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: coJson.keyId || statusRes.keyId,
          amount: coJson.order.amount,
          currency: coJson.order.currency || 'INR',
          name: 'Salt World',
          description: 'Gift card',
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
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-16">
        {/* Hero */}
        <section className="pt-16 md:pt-24 pb-10 md:pb-14 bg-background">
          <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
            <div className="md:col-span-6">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                <Gift className="h-3.5 w-3.5" /> Gift experiences
              </div>
              <h1 className="mt-4 font-serif text-[44px] md:text-[68px] leading-[1] tracking-tight text-balance">
                A gift they&rsquo;ll<br /><span className="italic text-brand">actually use.</span>
              </h1>
              <p className="mt-5 text-[15.5px] md:text-[16px] leading-8 text-muted-foreground max-w-[520px]">
                Gift a specific experience — a full outcome package like Stress Relief or Recovery — or a flexible amount
                they can put toward anything. Paid and issued instantly; print it or send it whenever you&rsquo;re ready.
              </p>
              <ul className="mt-6 grid grid-cols-2 gap-y-2 gap-x-6 text-[13.5px] text-foreground/80 max-w-[520px]">
                {['Any amount from ₹500','Six curated designs','Valid 12 months','Recipient optional at purchase','Printable certificate','Redeemable at booking'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand shrink-0" /> {f}</li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-6 relative flex items-center justify-center min-h-[280px] md:min-h-[420px]">
              <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--brand) / 0.10), transparent 65%)' }} />
              <GiftCardPreview designId={designId} amount={effectiveAmount} occasion={occasion} to={toName} from={fromName} size="lg" />
            </div>
          </div>
        </section>

        {/* Gift a specific experience */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="max-w-[1240px] mx-auto px-5 md:px-8">
            <div className="max-w-[640px]">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Gift an experience</div>
              <h2 className="mt-3 font-serif text-[32px] md:text-[44px] leading-[1.05] tracking-tight text-balance">Gift the exact experience.</h2>
              <p className="mt-3 text-[14px] text-muted-foreground">Pick an outcome, choose a package, and gift that full journey — not just a balance.</p>
            </div>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {GIFTABLE_OUTCOMES.map((o) => {
                const Icon = o.icon;
                const fromPrice = [o.pricing?.single, o.pricing?.pack, o.pricing?.membership]
                  .map((t) => Number(String(t?.price || '').replace(/[^\d]/g, '')))
                  .filter((n) => n > 0)
                  .sort((a, b) => a - b)[0];
                return (
                  <Link key={o.slug} href={`/gift/${o.slug}`} className="group rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center">
                      {Icon && <Icon className="h-4.5 w-4.5" />}
                    </div>
                    <div className="mt-4 text-[15px] font-semibold">{o.title}</div>
                    <div className="mt-1 text-[12.5px] text-muted-foreground">From {formatINR(fromPrice)}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-foreground group-hover:gap-1.5 transition-all">
                      Gift this <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Gift any amount */}
        <section className="py-16 md:py-24 border-t border-border" style={{ background: 'hsl(var(--muted))' }}>
          <div className="max-w-[1240px] mx-auto px-5 md:px-8">
            <div className="max-w-[720px]">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Or gift any amount</div>
              <h2 className="mt-3 font-serif text-[32px] md:text-[44px] leading-[1.05] tracking-tight text-balance">Let them choose.</h2>
            </div>

            <div className="mt-10 grid md:grid-cols-2 gap-10 md:gap-14">
              <div className="space-y-8 order-2 md:order-1 pb-20 md:pb-0">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Amount</div>
                  <div className="flex flex-wrap gap-2">
                    {DENOMINATIONS.map((v) => (
                      <button key={v} onClick={() => { setAmount(v); setCustomAmount(''); setFieldErrors((er) => ({ ...er, amount: undefined })); }}
                        className={`h-10 px-4 rounded-full border text-[13.5px] font-medium transition-colors ${!customAmount && amount === v ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground hover:bg-muted'}`}>
                        {formatINR(v)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Custom amount (min ₹{MIN_GIFT_AMOUNT})</label>
                    <input type="number" min={MIN_GIFT_AMOUNT} step={50} value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setFieldErrors((er) => ({ ...er, amount: undefined })); }}
                      placeholder={`e.g. 1000`}
                      className={`mt-2 w-full h-11 px-3.5 rounded-full border bg-background text-[14px] focus:outline-none focus:ring-2 ${fieldErrors.amount ? 'border-destructive focus:ring-destructive/40' : 'border-border focus:ring-ring'}`} />
                    {fieldErrors.amount && <div className="mt-1 ml-1 text-[11.5px] text-destructive">{fieldErrors.amount}</div>}
                  </div>
                </div>

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
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Occasion</div>
                  <OccasionPicker value={occasion} onChange={setOccasion} allowNone={false} />
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
                    <input value={toName}   onChange={(e) => setToName(e.target.value)}   placeholder="Their name"   className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
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
                <GiftCardPreview designId={designId} amount={effectiveAmount} occasion={occasion} to={toName} from={fromName} message={message} size="lg" />
                <div className="hidden md:block mt-6 rounded-2xl border border-border bg-card p-5">
                  <CashPriceAndPay effectiveAmount={effectiveAmount} customerLoaded={customerLoaded} customer={customer} busy={busy} pay={pay} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppFab />

      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2">
        <div className="rounded-2xl shadow-xl p-4" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <CashPriceAndPay effectiveAmount={effectiveAmount} customerLoaded={customerLoaded} customer={customer} busy={busy} pay={pay} compact />
        </div>
      </div>
    </div>
  );
}

function CashPriceAndPay({ effectiveAmount, customerLoaded, customer, busy, pay, compact }) {
  return (
    <>
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-muted-foreground">Total</span>
        <span className="font-serif text-[24px]">{formatINR(effectiveAmount)}</span>
      </div>
      {customerLoaded && !customer ? (
        <Link href={`/account/login?next=${encodeURIComponent('/gifts')}`}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
          Sign in to continue <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <button onClick={pay} disabled={busy || !customerLoaded}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><Sparkles className="h-4 w-4" /> Pay & create gift</>}
        </button>
      )}
      {!compact && <div className="mt-3 text-[11.5px] text-muted-foreground">No recipient yet? That&rsquo;s fine — add their details later from your account.</div>}
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
