'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Wind, Moon, Dumbbell, Activity, Heart,
  Infinity as InfinityIcon, Sun, Users, Star, Sparkles, ChevronDown,
  MessageCircle, Check, Phone, ShieldCheck, Droplets, Award, MapPin, Clock,
  BadgeCheck, Gift, Building2, ChevronRight, Loader2,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';
import {
  TopNav, SiteFooter, StickyBookingBar, AnnouncementBar, WhatsAppFab, useRise,
} from '@/components/site/shell';
import GiftCardPreview from '@/components/site/gift-card-preview';

/* Homepage content ------------------------------------------------------- */

const IMG = {
  hero:     'https://images.unsplash.com/photo-1580291339839-e2d207553b81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHw0fHxtaW5pbWFsaXN0JTIwcG9vbHxlbnwwfHx8d2hpdGV8MTc4MzUxMjI5Mnww&ixlib=rb-4.1.0&q=85&w=2400&h=1600&fit=crop',
  featured: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHx3YXRlciUyMHN1cmZhY2V8ZW58MHx8fHdoaXRlfDE3ODM1MTIyNzN8MA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop',
  j1:       'https://images.unsplash.com/photo-1609940170579-60f916a78e56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwYmVkfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
  j2:       'https://images.unsplash.com/photo-1486382630970-831dcf080d6f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxoYW5kcyUyMHJlY292ZXJ5fGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
  j3:       'https://images.unsplash.com/photo-1635425291333-8484fc42dc13?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxjb3VwbGUlMjBzaWxob3VldHRlfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjczfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
  corp:     'https://images.unsplash.com/photo-1486382630970-831dcf080d6f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxoYW5kcyUyMHJlY292ZXJ5fGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
};

const OUTCOMES = [
  { slug: 'stress-relief',       icon: Wind,         title: 'Stress Relief',       line: 'Forty-five quiet minutes back to yourself.', dur: '45 min', from: 1499, cadence: '2×/wk · 4 wks' },
  { slug: 'better-sleep',        icon: Moon,         title: 'Better Sleep',        line: 'Deeper, more consistent nights.',           dur: '60 min', from: 1999, cadence: '2×/wk · 4 wks' },
  { slug: 'muscle-recovery',     icon: Dumbbell,     title: 'Muscle Recovery',     line: 'Faster reset for athletes and weekenders.',  dur: '90 min', from: 2499, cadence: '1–2×/wk' },
  { slug: 'pain-relief',         icon: Activity,     title: 'Pain Relief',         line: 'Gentle, drug-free relief for chronic pain.', dur: '75 min', from: 2199, cadence: '2×/wk · 6 wks' },
  { slug: 'couple-activities',   icon: Heart,        title: 'Couple Activities',   line: 'A shared wellness date, done right.',        dur: '90 min', from: 2999, cadence: 'On request' },
  { slug: 'longevity',           icon: InfinityIcon, title: 'Longevity',           line: 'Small habits, compounded over years.',       dur: '75 min', from: 1999, cadence: '1–2×/wk' },
  { slug: 'skin-rejuvenation',   icon: Sun,          title: 'Skin Rejuvenation',   line: 'Red-light protocols for glow and repair.',   dur: '60 min', from: 1799, cadence: '2×/wk · 6 wks' },
  { slug: 'corporate-wellness',  icon: Users,        title: 'Corporate Wellness',  line: 'Programmes for teams that ship.',            dur: 'Custom', from: null, cadence: 'Cohort' },
];

const REVIEWS = [
  { quote: "The team knows me by name. Sunday sessions have become non-negotiable.",          author: 'Rohan Menon',    role: 'Product Manager · Koramangala' },
  { quote: "My five-year-old\u2019s inhaler use is down to almost zero. This place is real.", author: 'Priya Nair',     role: 'Parent · Indiranagar' },
  { quote: "I sleep the same night as my session. I don\u2019t know a faster reset.",          author: 'Sneha Kulkarni', role: 'Founder · HSR Layout' },
];

const JOURNAL = [
  { slug: 'four-weeks-to-deeper-sleep',   cat: 'Better Sleep',      title: 'Four weeks to deeper sleep',                   excerpt: 'A short, evidence-led protocol you can start this Sunday.',       img: IMG.j1, date: 'Jun 2026' },
  { slug: 'what-actually-helps-recovery', cat: 'Muscle Recovery',   title: 'What actually helps recovery',                 excerpt: 'A running-club member breaks down the stack that worked for her.', img: IMG.j2, date: 'May 2026' },
  { slug: 'the-quiet-date-night',         cat: 'Couple Activities', title: 'The quiet date night you\u2019ve been missing', excerpt: 'Ninety minutes together, without a phone in sight.',              img: IMG.j3, date: 'May 2026' },
];

const WHATSAPP = 'https://wa.me/919916019755';
const PHONE = '+919916019755';

const inr = (n) => (typeof n === 'number' ? '\u20B9' + n.toLocaleString('en-IN') : '');

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

function GoogleG({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.4 30.32 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function TrustBar({ inverted = false }) {
  const base = inverted ? 'text-white/85' : 'text-foreground/75';
  const sep = inverted ? 'text-white/30' : 'text-foreground/25';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]', base)}>
      <div className="inline-flex items-center gap-1.5">
        <GoogleG />
        <span className="font-semibold">4.9</span>
        <span className={inverted ? 'text-white/70' : 'text-foreground/60'}>· 487 Google reviews</span>
      </div>
      <span className={sep}>·</span>
      <div className="inline-flex items-center gap-1.5">
        <BadgeCheck className="h-3.5 w-3.5" />
        <span>8 years in HSR · 1,200 members</span>
      </div>
      <span className={cn(sep, 'hidden md:inline')}>·</span>
      <div className="hidden md:inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span>Sessions from 45 min · {inr(1499)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Hero                                                             */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[680px] w-full overflow-hidden">
      <img
        src={IMG.hero}
        alt="A quiet, sun-lit pool in the Salt World sanctuary"
        className="absolute inset-0 h-full w-full object-cover anim-kenburns"
        fetchPriority="high" loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="max-w-[1240px] mx-auto px-5 md:px-8 w-full">
            <div className="max-w-[760px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/90">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--aurora))' }} />
                Bengaluru · Est. 2017
              </div>

              <h1 className="mt-6 font-serif text-white text-[44px] md:text-[76px] leading-[0.98] tracking-tight text-balance">
                What brings you<br />here today?
              </h1>

              <p className="mt-5 text-white/85 text-[16px] md:text-[18px] leading-8 max-w-[540px]">
                A wellness sanctuary designed around the outcome you want &mdash; deeper sleep,
                a quieter mind, a body that recovers faster. Book your first quiet forty-five minutes.
              </p>

              {/* Outcome chips */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                {[
                  { label: 'I\u2019m stressed',      href: '/outcomes/stress-relief' },
                  { label: 'I want better sleep',    href: '/outcomes/better-sleep' },
                  { label: 'I need recovery',         href: '/outcomes/muscle-recovery' },
                  { label: 'Gift someone',            href: '/gifts' },
                ].map((chip) => (
                  <Link
                    key={chip.label} href={chip.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur px-4 h-10 text-[13.5px] text-white hover:bg-white/20 hover:border-white/40 transition-colors"
                  >
                    {chip.label} <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                  </Link>
                ))}
              </div>

              {/* Primary CTAs — the CRO move */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold text-[14.5px] transition-all hover:brightness-110"
                  style={{ background: 'hsl(var(--aurora))', color: 'hsl(var(--aurora-foreground))' }}
                >
                  Book a session <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={WHATSAPP} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full border border-white/30 bg-white/10 backdrop-blur text-white font-medium text-[14px] hover:bg-white/20 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                </a>
              </div>

              {/* Trust bar */}
              <div className="mt-8">
                <TrustBar inverted />
              </div>
            </div>
          </div>
        </div>

        <div className="pb-8 flex items-center justify-center text-white/70 text-[11px] uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2">Scroll <ChevronDown className="h-3 w-3 animate-bounce" /></div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Outcome Selector                                                 */
/* ------------------------------------------------------------------ */

function OutcomeSelector() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="relative py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="max-w-[720px]">
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Begin with the outcome</div>
          <h2 className="rise font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight mt-3 text-balance">
            We don&rsquo;t sell therapies.<br />
            <span className="italic text-brand">We sell outcomes.</span>
          </h2>
          <p className="rise mt-5 text-[15.5px] md:text-[16px] leading-8 text-muted-foreground max-w-[560px]">
            Choose how you want to feel. We&rsquo;ll match you with the right protocol &mdash; float, salt,
            infrared, cold plunge, or red-light &mdash; and design a rhythm you&rsquo;ll actually keep.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {OUTCOMES.map((o) => (
            <div
              key={o.slug}
              className="rise group relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6 min-h-[212px] md:min-h-[236px] flex flex-col justify-between hover:border-foreground/40 hover:-translate-y-0.5 transition-all duration-300"
            >
              <Link href={`/outcomes/${o.slug}`} className="absolute inset-0 z-0" aria-label={o.title} />
              <div className="flex items-start justify-between relative z-10 pointer-events-none">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <o.icon className="h-4 w-4" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>

              <div className="relative z-10 pointer-events-none">
                <div className="font-serif text-[19px] md:text-[22px] leading-tight tracking-tight text-foreground">{o.title}</div>
                <div className="mt-1.5 text-[12.5px] md:text-[13px] leading-5 text-muted-foreground text-pretty">{o.line}</div>

                {/* Meta strip */}
                <div className="mt-3 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-foreground/60">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{o.dur}</span>
                  {o.from && <><span className="text-foreground/30">·</span><span>From {inr(o.from)}</span></>}
                </div>
              </div>

              {/* Inline Book — pointer-events enabled */}
              <Link
                href={o.slug === 'corporate-wellness' ? '#corporate' : `/book?outcome=${o.slug}`}
                className="absolute right-4 bottom-4 z-20 inline-flex items-center gap-1 rounded-full bg-foreground text-background text-[11.5px] font-semibold px-3 h-7 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all"
              >
                {o.slug === 'corporate-wellness' ? 'Enquire' : 'Book'} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. First Visit — What happens during your visit                     */
/* ------------------------------------------------------------------ */

function FirstVisit() {
  const ref = useRef(null);
  useRise(ref);
  const steps = [
    { n: 1, dur: '5 min',      title: 'Arrive',           body: 'Warm herbal tea on arrival. No paperwork on your first day.' },
    { n: 2, dur: '5 min',      title: 'Change & orient',   body: 'Lockers, robes, sandals. A quick walkthrough of what to expect.' },
    { n: 3, dur: '45–60 min',  title: 'Your protocol',     body: 'The quiet part. We handle time so you don\u2019t have to.' },
    { n: 4, dur: '10 min',     title: 'Lounge',            body: 'Water, jasmine tea, and no rush to leave.' },
  ];
  return (
    <section ref={ref} className="py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div className="max-w-[640px]">
            <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Your first visit</div>
            <h3 className="rise mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
              Exactly what happens<br /><span className="italic">from door to door.</span>
            </h3>
          </div>
          <div className="rise text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-card">
              <Clock className="h-3.5 w-3.5" /> Total: 75–90 minutes door-to-door
            </span>
          </div>
        </div>

        <ol className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          {steps.map((s) => (
            <li key={s.n} className="rise relative rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand text-[13px] font-semibold">{s.n}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{s.dur}</div>
              </div>
              <div>
                <div className="font-serif text-[20px] tracking-tight text-foreground">{s.title}</div>
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rise mt-8 flex flex-wrap items-center gap-3">
          <Link href="/book" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
            Book your first session <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-border text-foreground text-[14px] font-medium hover:bg-muted transition-colors">
            <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Why Salt World isn't a spa                                       */
/* ------------------------------------------------------------------ */

function WhySaltWorld() {
  const ref = useRef(null);
  useRise(ref);
  const rows = [
    { k: 'Sold by',        spa: 'Therapy (massage, facial)', sw: 'Outcome (sleep, stress, recovery)' },
    { k: 'During',         spa: 'Frequent product upsells',    sw: 'No upsells. Ever.' },
    { k: 'Cadence',        spa: 'One-off treats',              sw: 'Weekly protocol, held for weeks' },
    { k: 'Team',           spa: 'Rotating therapists',          sw: 'Named wellness lead, on record' },
    { k: 'Measurement',    spa: 'None',                         sw: 'Sleep-log, VAS, HRV tracked' },
    { k: 'After',          spa: 'Retail counter',                sw: 'Warm tea. No push.' },
  ];
  return (
    <section ref={ref} className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="max-w-[720px]">
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">The difference</div>
          <h3 className="rise mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
            Not a spa. <span className="italic">A protocol.</span>
          </h3>
          <p className="rise mt-5 text-[15.5px] leading-8 text-muted-foreground max-w-[560px]">
            Salt World is closer to a clinic than a spa &mdash; and closer to a sanctuary than a clinic.
            Six honest ways we&rsquo;re built differently.
          </p>
        </div>

        <div className="rise mt-12 grid md:grid-cols-2 gap-4 md:gap-6">
          <div className="rounded-2xl border border-border bg-background p-6 md:p-8">
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Traditional spa</div>
            <ul className="mt-5 divide-y divide-border">
              {rows.map((r) => (
                <li key={r.k} className="py-3.5 flex items-start gap-4">
                  <span className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground w-24 md:w-28 shrink-0 pt-0.5">{r.k}</span>
                  <span className="text-[14px] text-foreground/60">{r.spa}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 p-6 md:p-8 bg-background relative" style={{ borderColor: 'hsl(var(--brand))' }}>
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ background: 'hsl(var(--brand))', color: 'hsl(var(--brand-foreground))' }}>
              <Sparkles className="h-3 w-3" /> Salt World
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-brand mt-2">The protocol</div>
            <ul className="mt-5 divide-y divide-border">
              {rows.map((r) => (
                <li key={r.k} className="py-3.5 flex items-start gap-4">
                  <span className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground w-24 md:w-28 shrink-0 pt-0.5">{r.k}</span>
                  <span className="text-[14px] font-medium text-foreground">{r.sw}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Featured — Float (refined)                                       */
/* ------------------------------------------------------------------ */

function FeaturedExperience() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="relative py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-6 rise">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl">
            <img src={IMG.featured} alt="Water surface lit by warm morning light" className="absolute inset-0 h-full w-full object-cover anim-kenburns" loading="lazy" />
            <div className="absolute left-4 top-4 rounded-full bg-background/90 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/80">
              Featured this month
            </div>
            <div className="absolute right-4 bottom-4 rounded-full bg-foreground text-background backdrop-blur px-3.5 py-1.5 text-[11.5px] font-semibold inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'hsl(var(--aurora))' }} />
              Next slot today · 6:30 PM
            </div>
          </div>
        </div>
        <div className="md:col-span-6">
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Float Therapy · 60 minutes · From {inr(1999)}</div>
          <h3 className="rise mt-3 font-serif text-[38px] md:text-[54px] leading-[1.02] tracking-tight text-balance">
            Weightless.<br /><span className="italic">Silent.</span> Restorative.
          </h3>
          <p className="rise mt-5 text-[15.5px] md:text-[16px] leading-8 text-muted-foreground max-w-[520px]">
            Sixty minutes in body-temperature saltwater. No sound, no light, no gravity.
            The nervous system exhales. Sleep improves the same night.
          </p>
          <ul className="rise mt-6 space-y-2.5 text-[14px] leading-6 text-foreground/80">
            {['60 minutes · single or shared cabin', 'Post-float lounge with jasmine tea', 'Best paired with red-light for skin recovery'].map((li) => (
              <li key={li} className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                <span>{li}</span>
              </li>
            ))}
          </ul>
          <div className="rise mt-8 flex flex-wrap items-center gap-3">
            <Link href="/book?therapy=float-therapy" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
              Book a float <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/outcomes/better-sleep" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-border text-foreground text-[14px] font-medium hover:bg-muted transition-colors">
              How floating works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Membership — with savings math                                   */
/* ------------------------------------------------------------------ */

function MembershipTease() {
  const ref = useRef(null);
  useRise(ref);
  // 8 sessions/mo × ₹1,499 = ₹11,992  vs  ₹3,499  →  ₹8,493 saved
  const savings = 8 * 1499 - 3499;
  return (
    <section ref={ref} className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Membership</div>
          <h3 className="rise mt-3 font-serif text-[38px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
            Members come <span className="italic">first.</span>
          </h3>
          <p className="rise mt-5 text-[15.5px] leading-8 text-muted-foreground max-w-[500px]">
            Consistency is what changes how you feel. Members book first, pay less, and get the rhythm that
            actually holds &mdash; not the one you meant to keep.
          </p>
          <ul className="rise mt-6 space-y-3 text-[14.5px] text-foreground/85">
            {[
              'Priority booking, up to 14 days in advance',
              'Save 20% on every session, guest passes included',
              'Complimentary quarterly consult with our wellness lead',
              'Free freeze on any month you\u2019re travelling',
            ].map((li) => (
              <li key={li} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--brand))' }} />
                <span>{li}</span>
              </li>
            ))}
          </ul>

          {/* Trust row */}
          <div className="rise mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand" /> Cancel anytime</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand" /> No joining fee</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand" /> Freeze during travel</span>
          </div>
        </div>

        <div className="rise">
          <div className="relative rounded-2xl border-2 p-8 bg-card" style={{ borderColor: 'hsl(var(--brand))' }}>
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ background: 'hsl(var(--brand))', color: 'hsl(var(--brand-foreground))' }}>
              <Sparkles className="h-3 w-3" /> Most chosen
            </div>
            <div className="text-[11.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Wellness</div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-serif text-[56px] leading-none tracking-tight">{inr(3499)}</div>
              <div className="text-[13px] text-muted-foreground">/ month</div>
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">Billed monthly · cancel anytime</div>

            {/* Savings math */}
            <div className="mt-4 rounded-lg p-3.5 text-[12.5px] leading-5" style={{ background: 'hsl(var(--brand) / 0.08)', color: 'hsl(var(--brand))' }}>
              <span className="font-semibold">Save {inr(savings)} / month</span> vs pay-per-session at 8 sessions.
            </div>

            <ul className="mt-6 space-y-2.5 text-[14px]">
              {['8 sessions across any therapy','Priority slot booking (up to 14 days)','20% off retail & guest passes','Quarterly wellness consult'].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                  <span className="text-foreground/85">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link href="/memberships" className="inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
                Join now <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 h-11 rounded-full border border-border text-foreground text-[13.5px] font-medium hover:bg-muted transition-colors">
                <MessageCircle className="h-4 w-4" /> Ask a question
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Gift Cards Band                                                  */
/* ------------------------------------------------------------------ */

function GiftBand() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="py-24 md:py-32 bg-background overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-6 order-2 md:order-1">
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Gift experiences</div>
          <h3 className="rise mt-3 font-serif text-[38px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
            The gift they&rsquo;ll <span className="italic">actually use.</span>
          </h3>
          <p className="rise mt-5 text-[15.5px] leading-8 text-muted-foreground max-w-[480px]">
            Any denomination, six editorial designs, delivered by email or WhatsApp &mdash; the day they need it most.
            Anniversaries, birthdays, thank-yous, or a quiet Wednesday.
          </p>
          <ul className="rise mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px] text-foreground/80">
            {['Any amount from ₹1,500', 'Instant or scheduled delivery', 'Six curated designs', 'Corporate gifting on invoice'].map((f) => (
              <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand shrink-0" /> {f}</li>
            ))}
          </ul>
          <div className="rise mt-8 flex flex-wrap items-center gap-3">
            <Link href="/gifts" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
              Design a gift <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a href={`${WHATSAPP}?text=${encodeURIComponent('Hi! I\u2019d like to send a Salt World gift.')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-border text-foreground text-[14px] font-medium hover:bg-muted transition-colors">
              <MessageCircle className="h-4 w-4" /> WhatsApp to gift
            </a>
          </div>
        </div>

        <div className="md:col-span-6 order-1 md:order-2 rise">
          <div className="relative flex items-center justify-center min-h-[300px] md:min-h-[400px]">
            <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--brand) / 0.10), transparent 65%)' }} />
            <div className="absolute -rotate-[8deg] -translate-x-8 -translate-y-2 opacity-90 hidden sm:block">
              <GiftCardPreview designId="bone" amount={5000} occasion="Thank you" size="sm" />
            </div>
            <div className="absolute rotate-[6deg] translate-x-10 translate-y-6 opacity-90 hidden sm:block">
              <GiftCardPreview designId="driftwood" amount={10000} occasion="Anniversary" size="sm" />
            </div>
            <div className="relative z-10">
              <GiftCardPreview designId="halite" amount={5000} from="Ananya" to="Rohit" occasion="Birthday" size="md" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Reviews                                                          */
/* ------------------------------------------------------------------ */

function Reviews() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div className="max-w-[720px]">
            <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Loved in Bengaluru</div>
            <h3 className="rise mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
              1,200 members. <span className="italic">One quiet room.</span>
            </h3>
          </div>

          {/* Google rating card */}
          <div className="rise inline-flex items-center gap-4 rounded-2xl border border-border bg-background px-5 py-3">
            <GoogleG className="h-6 w-6" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-[24px] leading-none tracking-tight">4.9</span>
                <span className="flex items-center gap-0.5">{[0,1,2,3,4].map((k) => <Star key={k} className="h-3 w-3 fill-current" style={{ color: 'hsl(var(--aurora))' }} />)}</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">487 verified reviews · <a href="https://www.google.com/search?q=Salt+World+HSR+Bengaluru" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">See on Google</a></div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {REVIEWS.map((r, i) => (
            <figure key={i} className="rise rounded-2xl border border-border bg-card p-7 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">{[0,1,2,3,4].map((k) => <Star key={k} className="h-3.5 w-3.5 fill-current" style={{ color: 'hsl(var(--aurora))' }} />)}</div>
                <GoogleG className="h-3.5 w-3.5 opacity-70" />
              </div>
              <blockquote className="mt-4 font-serif text-[19px] leading-[1.4] text-foreground text-pretty">&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 pt-4 border-t border-border">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-[12px] font-semibold text-muted-foreground border border-border">
                  {r.author.split(' ').map((x) => x[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div className="text-[13.5px] font-medium text-foreground leading-tight">{r.author}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">{r.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Media strip */}
        <div className="mt-10 pt-8 border-t border-border">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold text-center">As seen in</div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-70">
            {['Bangalore Mirror', 'BioSpectrum', 'Business Standard', 'Deccan Herald', 'YourStory'].map((m) => (
              <span key={m} className="font-serif text-[18px] md:text-[20px] tracking-tight text-foreground/70">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Trust badges strip                                               */
/* ------------------------------------------------------------------ */

function TrustBadges() {
  const ref = useRef(null);
  useRise(ref);
  const items = [
    { icon: ShieldCheck, k: 'Certified halotherapists',      s: 'ISH-trained clinical staff' },
    { icon: Droplets,    k: 'Medical-grade filtration',       s: '15-micron UV + ozone cycle' },
    { icon: BadgeCheck,  k: 'Insured & GST-compliant',        s: 'Corporate invoicing available' },
    { icon: Clock,       k: 'Open 7 days · 6 AM – 9 PM',      s: 'Same-day slots most days' },
    { icon: Award,       k: '8 years in HSR Layout',           s: '1,200+ recurring members' },
    { icon: MapPin,      k: 'Discreet HSR sanctuary',          s: 'Sector 7, 3rd floor · valet parking' },
  ];
  return (
    <section ref={ref} className="py-16 md:py-20 bg-background border-y border-border">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
          {items.map((it) => (
            <div key={it.k} className="rise flex items-start gap-3.5">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <it.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-foreground leading-tight">{it.k}</div>
                <div className="text-[12.5px] text-muted-foreground mt-1">{it.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 10. Corporate Wellness lead band                                    */
/* ------------------------------------------------------------------ */

function CorporateBand() {
  const ref = useRef(null);
  useRise(ref);
  const [form, setForm] = useState({ name: '', email: '', company: '', teamSize: '', notes: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.name) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'corporate-band' }),
      });
      if (!res.ok) throw new Error('bad_response');
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  };
  return (
    <section id="corporate" ref={ref} className="py-24 md:py-32" style={{ background: 'hsl(var(--foreground))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-16 items-center" style={{ color: 'hsl(var(--background))' }}>
        <div className="md:col-span-6">
          <div className="rise inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'hsl(var(--aurora))' }}>
            <Building2 className="h-3.5 w-3.5" /> Corporate wellness
          </div>
          <h3 className="rise mt-3 font-serif text-[36px] md:text-[54px] leading-[1.02] tracking-tight text-balance">
            The benefit your team<br /><span className="italic">will actually use.</span>
          </h3>
          <p className="rise mt-5 text-[15.5px] leading-8 max-w-[520px]" style={{ color: 'hsl(var(--background) / 0.72)' }}>
            Outcome-first cohort programmes for founders, engineering teams and studios. Anonymised utilisation
            dashboards for HR, no step-counting gimmicks, delivered in Bengaluru.
          </p>
          <div className="rise mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { n: '82%', l: 'Utilisation' },
              { n: '94%', l: 'Would recommend' },
              { n: '24',  l: 'Cohorts delivered' },
              { n: 'Net-30', l: 'Invoicing' },
            ].map((m) => (
              <div key={m.l}>
                <div className="font-serif text-[26px] tracking-tight">{m.n}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] mt-1" style={{ color: 'hsl(var(--background) / 0.6)' }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-6 rise">
          <div className="rounded-2xl p-6 md:p-8" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
            {status === 'ok' ? (
              <div className="py-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-brand/10 text-brand flex items-center justify-center"><Check className="h-5 w-5" /></div>
                <div className="mt-4 font-serif text-[24px] tracking-tight">Thanks &mdash; we&rsquo;ll be in touch.</div>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Our team-plan lead will email you within one working day with a tailored proposal.</p>
                <a href={WHATSAPP} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-foreground text-background text-[13px] font-medium">
                  <MessageCircle className="h-3.5 w-3.5" /> Or ping us on WhatsApp
                </a>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3.5">
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Book a 20-minute discovery call</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Work email"
                    className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Company"
                    className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring" />
                  <select value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                    className="h-11 px-3.5 rounded-full border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Team size</option>
                    <option>1–15</option>
                    <option>16–50</option>
                    <option>51–150</option>
                    <option>150+</option>
                  </select>
                </div>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="What outcome matters most for your team? (optional)"
                  rows={2}
                  className="w-full px-3.5 py-3 rounded-2xl border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-70"
                  >
                    {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    {status === 'loading' ? 'Sending' : 'Request a proposal'}
                  </button>
                  <a href={`${WHATSAPP}?text=${encodeURIComponent('Hi! We\u2019d like to explore a corporate wellness cohort for our team.')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full border border-border text-foreground text-[13.5px] font-medium hover:bg-muted transition-colors">
                    <MessageCircle className="h-4 w-4" /> Or WhatsApp us
                  </a>
                </div>
                {status === 'error' && (
                  <div className="text-[12.5px] text-red-500">Something went wrong. Please try WhatsApp or email hello@saltworld.in.</div>
                )}
                <div className="text-[11.5px] text-muted-foreground pt-1">No spam. We reply within 1 working day. GST-compliant invoicing.</div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 11. Journal                                                         */
/* ------------------------------------------------------------------ */

function JournalPreview() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Journal</div>
            <h3 className="rise mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
              Field notes on <span className="italic">wellness.</span>
            </h3>
          </div>
          <Link href="/journal" className="rise inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:gap-2.5 transition-all">
            Read the journal <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {JOURNAL.map((j) => (
            <Link key={j.slug} href={`/journal/${j.slug}`} className="rise group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                <img src={j.img} alt={j.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.06]" loading="lazy" />
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>{j.cat}</span><span>·</span><span>{j.date}</span>
              </div>
              <h4 className="mt-2 font-serif text-[22px] md:text-[26px] leading-[1.15] tracking-tight text-foreground group-hover:text-brand transition-colors text-pretty">{j.title}</h4>
              <p className="mt-2 text-[13.5px] text-muted-foreground leading-6 text-pretty">{j.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 12. Final CTA                                                       */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  return (
    <section className="relative py-24 md:py-36 overflow-hidden" style={{ background: 'hsl(var(--foreground))' }}>
      <div className="absolute inset-0 opacity-[0.06]"><div className="grid-bg absolute inset-0" /></div>
      <div className="relative max-w-[1240px] mx-auto px-5 md:px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--aurora))' }}>
          <Sparkles className="h-3 w-3" /> First session complimentary this month
        </div>
        <h3 className="mt-6 font-serif text-[44px] md:text-[76px] leading-[1] tracking-tight text-balance" style={{ color: 'hsl(var(--background))' }}>
          Ready for your first<br /><span className="italic">quiet forty-five minutes?</span>
        </h3>
        <p className="mt-6 text-[15.5px] md:text-[17px] leading-8 max-w-[540px] mx-auto" style={{ color: 'hsl(var(--background) / 0.7)' }}>
          Book online, call us, or send a WhatsApp &mdash; we reply within minutes during opening hours.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/book" className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold text-[15px] transition-all hover:brightness-110" style={{ background: 'hsl(var(--aurora))', color: 'hsl(var(--aurora-foreground))' }}>
            Book a session <ArrowRight className="h-4 w-4" />
          </Link>
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-12 px-6 rounded-full border font-medium text-[14.5px] transition-colors" style={{ borderColor: 'hsl(var(--background) / 0.2)', color: 'hsl(var(--background))' }}>
            <MessageCircle className="h-4 w-4" /> WhatsApp us
          </a>
          <a href={`tel:${PHONE}`} className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-medium text-[14.5px] transition-colors hover:bg-white/5" style={{ color: 'hsl(var(--background) / 0.85)' }}>
            <Phone className="h-4 w-4" /> {PHONE}
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const App = () => (
  <div className="min-h-screen bg-background">
    <AnnouncementBar />
    <TopNav transparentHero />
    <main>
      <Hero />
      <OutcomeSelector />
      <FirstVisit />
      <WhySaltWorld />
      <FeaturedExperience />
      <MembershipTease />
      <GiftBand />
      <Reviews />
      <TrustBadges />
      <CorporateBand />
      <JournalPreview />
      <FinalCTA />
    </main>
    <SiteFooter />
    <StickyBookingBar />
    <WhatsAppFab />
  </div>
);

export default App;
