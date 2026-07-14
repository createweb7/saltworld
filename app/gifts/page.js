'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, MessageCircle, Gift, Sparkles } from 'lucide-react';
import { TopNav, SiteFooter, WhatsAppFab } from '@/components/site/shell';
import GiftCardPreview from '@/components/site/gift-card-preview';
import { GIFT_DESIGNS, DENOMINATIONS, formatINR } from '@/lib/gift-designs';

const WHATSAPP = 'https://wa.me/917687878793';

const OCCASION = [
  { id: 'birthday',     label: 'Birthday' },
  { id: 'anniversary',  label: 'Anniversary' },
  { id: 'thank-you',    label: 'Thank you' },
  { id: 'congrats',     label: 'Congratulations' },
  { id: 'just-because', label: 'Just because' },
  { id: 'corporate',    label: 'Corporate' },
];

export default function GiftsPage() {
  const [designId, setDesignId] = useState('halite');
  const [amount, setAmount] = useState(5000);
  const [occasion, setOccasion] = useState('Birthday');
  const [to, setTo] = useState('Rohit');
  const [from, setFrom] = useState('Ananya');

  const whatsappHref =
    `${WHATSAPP}?text=${encodeURIComponent(
      `Hi! I\u2019d like to send a Salt World gift card.\n\nDesign: ${designId}\nAmount: ${formatINR(amount)}\nOccasion: ${occasion}\nTo: ${to}\nFrom: ${from}`
    )}`;

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
                Choose a design, any amount, delivered by email or WhatsApp &mdash; scheduled for the day it matters.
                Corporate gifting available on GST-compliant invoice.
              </p>
              <ul className="mt-6 grid grid-cols-2 gap-y-2 gap-x-6 text-[13.5px] text-foreground/80 max-w-[520px]">
                {['Any amount from ₹1,500','Six curated designs','Instant or scheduled','Corporate on invoice','Valid 12 months','Redeemable at booking'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand shrink-0" /> {f}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
                  Send this gift on WhatsApp <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <Link href="/#corporate" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-border text-foreground text-[14px] font-medium hover:bg-muted transition-colors">
                  Corporate gifting
                </Link>
              </div>
              <div className="mt-4 text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-brand" /> Full designer with instant delivery arriving next week.
              </div>
            </div>

            {/* Live preview */}
            <div className="md:col-span-6 relative flex items-center justify-center min-h-[280px] md:min-h-[420px]">
              <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--brand) / 0.10), transparent 65%)' }} />
              <GiftCardPreview designId={designId} amount={amount} occasion={occasion} to={to} from={from} size="lg" />
            </div>
          </div>
        </section>

        {/* Customiser */}
        <section className="py-16 md:py-24" style={{ background: 'hsl(var(--muted))' }}>
          <div className="max-w-[1240px] mx-auto px-5 md:px-8">
            <div className="max-w-[720px]">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Design your gift</div>
              <h2 className="mt-3 font-serif text-[32px] md:text-[44px] leading-[1.05] tracking-tight text-balance">Six designs. Any amount.</h2>
            </div>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {GIFT_DESIGNS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDesignId(d.id)}
                  className={`text-left rounded-2xl border-2 p-3 bg-background transition-all ${designId === d.id ? 'border-foreground' : 'border-transparent hover:border-border'}`}
                >
                  <GiftCardPreview designId={d.id} amount={amount} occasion={occasion} to={to} from={from} size="sm" />
                  <div className="mt-3 flex items-center justify-between px-1">
                    <div>
                      <div className="text-[13.5px] font-semibold">{d.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{d.tag}</div>
                    </div>
                    {designId === d.id && <div className="h-6 w-6 rounded-full bg-foreground text-background inline-flex items-center justify-center"><Check className="h-3.5 w-3.5" /></div>}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-10 grid md:grid-cols-2 gap-8">
              <div className="rounded-2xl bg-background border border-border p-6">
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Amount</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {DENOMINATIONS.map((v) => (
                    <button key={v} onClick={() => setAmount(v)}
                      className={`h-10 px-4 rounded-full border text-[13.5px] font-medium transition-colors ${amount === v ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground hover:bg-muted'}`}>
                      {formatINR(v)}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Custom amount</label>
                  <input type="number" min={500} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="mt-2 w-full h-11 px-3.5 rounded-full border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="rounded-2xl bg-background border border-border p-6 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Message</div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={to}   onChange={(e) => setTo(e.target.value)}   placeholder="To"   className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
                  <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <select value={occasion} onChange={(e) => setOccasion(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring">
                  {OCCASION.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
                </select>
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
                  <MessageCircle className="h-4 w-4" /> Send this on WhatsApp
                </a>
                <div className="text-[11.5px] text-muted-foreground">We&rsquo;ll confirm within minutes during opening hours (6 AM – 9 PM).</div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
