'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Check, Star, MessageCircle, ChevronDown,
  Sparkles, Clock, Calendar,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';
import { TopNav, SiteFooter, StickyBookingBar, useRise } from './shell';
import { getOutcome, getRelated } from '@/lib/outcomes';

function Hero({ outcome }) {
  return (
    <section className="relative pt-32 md:pt-44 pb-20 md:pb-28 overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="relative max-w-[1240px] mx-auto px-5 md:px-8">
        <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:text-foreground">Home</Link></li>
            <li className="opacity-40">/</li>
            <li><Link href="/#outcomes" className="hover:text-foreground">Outcomes</Link></li>
            <li className="opacity-40">/</li>
            <li className="text-foreground">{outcome.title}</li>
          </ol>
        </nav>
        <div className="mt-8 max-w-[860px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">
            <outcome.icon className="h-3 w-3" /> {outcome.eyebrow}
          </div>
          <h1 className="mt-6 font-serif text-[46px] md:text-[86px] leading-[0.96] tracking-tight text-foreground text-balance whitespace-pre-line">
            {outcome.hero.headline}
          </h1>
          <p className="mt-6 text-[16px] md:text-[18px] leading-8 text-muted-foreground max-w-[620px]">
            {outcome.hero.subhead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={`/book?outcome=${outcome.slug}`} className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-foreground text-background font-semibold text-[14.5px] hover:bg-foreground/90 transition-colors">
              Book my {outcome.title.toLowerCase()} <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#protocol" className="inline-flex items-center gap-2 h-12 px-6 rounded-full border border-border text-foreground text-[14px] font-medium hover:bg-background transition-colors">
              How the protocol works <ChevronDown className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeltResult({ outcome }) {
  const fr = outcome.feltResult;
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">The felt result</div>
        <div className="mt-3 font-serif text-[28px] md:text-[36px] tracking-tight text-foreground max-w-[720px]">{fr.lead}</div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {fr.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-8">
              <div className="font-serif text-[52px] md:text-[64px] leading-none tracking-tight text-brand">{s.delta}</div>
              <div className="mt-3 text-[13.5px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        {fr.quote && (
          <figure className="mt-12 max-w-[720px]">
            <blockquote className="font-serif text-[22px] md:text-[28px] leading-[1.35] text-foreground text-pretty">“{fr.quote}”</blockquote>
            <figcaption className="mt-4 text-[12.5px] uppercase tracking-[0.18em] text-muted-foreground">— {fr.author}</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}

function Science({ outcome }) {
  const s = outcome.science;
  return (
    <section className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">The science</div>
          <h2 className="mt-3 font-serif text-[36px] md:text-[46px] leading-[1.02] tracking-tight text-balance">{s.title}</h2>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          <p className="text-[16px] md:text-[17px] leading-8 text-foreground/85 text-pretty">{s.body}</p>
          {s.citation && (
            <div className="mt-6 text-[12px] text-muted-foreground border-t border-border pt-4 flex items-center gap-2">
              <span className="font-mono uppercase tracking-widest">Cited</span> {s.citation}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Protocol({ outcome }) {
  const p = outcome.protocol;
  return (
    <section id="protocol" className="py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-14 items-center">
        <div className="md:col-span-6 order-2 md:order-1">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{p.title}</div>
          <h2 className="mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">{p.primary}</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 max-w-[400px]">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"><Clock className="h-3 w-3" /> Duration</div>
              <div className="mt-1 font-serif text-[22px] text-foreground">{p.duration}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"><Calendar className="h-3 w-3" /> Frequency</div>
              <div className="mt-1 font-serif text-[15px] leading-tight text-foreground">{p.frequency}</div>
            </div>
          </div>
          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Therapies used</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.therapies.map((t) => (
                <Link key={t.slug} href={`/therapies/${t.slug}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] hover:border-foreground/40 hover:bg-muted/50 transition-colors">
                  <span className="font-medium text-foreground">{t.label}</span>
                  <span className="text-muted-foreground">· {t.role}</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-6 order-1 md:order-2">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl">
            <img src={p.image} alt={`${outcome.title} protocol`} className="absolute inset-0 h-full w-full object-cover anim-kenburns" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}

const FIRST_VISIT = [
  { step: 1, title: 'Arrive five minutes early', body: 'We\u2019ll settle you in with a warm herbal tea. No paperwork on arrival day.' },
  { step: 2, title: 'Change and orient',          body: 'Simple lockers, robes, sandals. Your therapist walks you through what to expect.' },
  { step: 3, title: 'Your protocol',              body: 'Forty-five to sixty quiet minutes. We handle time-keeping so you don\u2019t have to.' },
  { step: 4, title: 'Post-session lounge',        body: 'A calm space to come back slowly. Water, hot tea, and no rush to leave.' },
];

function FirstVisit() {
  return (
    <section className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Your first visit</div>
        <h2 className="mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance max-w-[720px]">
          Four steps. <span className="italic">Zero friction.</span>
        </h2>
        <ol className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          {FIRST_VISIT.map((s) => (
            <li key={s.step} className="rounded-2xl border border-border bg-card p-6 relative">
              <div className="font-serif text-[54px] leading-none tracking-tight text-brand/40">0{s.step}</div>
              <div className="mt-2 font-serif text-[19px] leading-tight text-foreground">{s.title}</div>
              <p className="mt-2 text-[13px] leading-6 text-muted-foreground text-pretty">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Pricing({ outcome }) {
  const tiles = [outcome.pricing.single, outcome.pricing.pack, outcome.pricing.membership];
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="max-w-[720px]">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Choose your rhythm</div>
          <h2 className="mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">Simple, transparent pricing.</h2>
        </div>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((t, i) => (
            <div key={i} className={cn('relative rounded-2xl p-8 bg-card', t.featured ? 'border-2 border-brand' : 'border border-border')}>
              {t.featured && (
                <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ background: 'hsl(var(--brand))', color: 'hsl(var(--brand-foreground))' }}>
                  <Sparkles className="h-3 w-3" /> Most chosen
                </div>
              )}
              <div className="text-[11.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{t.name}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="font-serif text-[46px] leading-none tracking-tight">{t.price}</div>
                {t.period && <div className="text-[13px] text-muted-foreground">{t.period}</div>}
              </div>
              <ul className="mt-6 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px]">
                    <Check className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/book?outcome=${outcome.slug}&plan=${encodeURIComponent(t.name)}`}
                className={cn('mt-7 inline-flex items-center justify-center gap-1.5 w-full h-11 rounded-full text-[14px] font-semibold transition-colors',
                  t.featured ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-border text-foreground hover:bg-muted')}>
                {t.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqAccordion({ outcome }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[900px] mx-auto px-5 md:px-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Questions members ask</div>
        <h2 className="mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
          Before you <span className="italic">book.</span>
        </h2>
        <div className="mt-10 rounded-2xl border border-border bg-card overflow-hidden">
          {outcome.faq.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-border last:border-b-0">
                <button onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                  <span className="font-serif text-[17px] md:text-[19px] leading-tight text-foreground">{f.q}</span>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-300', isOpen && 'rotate-180')} />
                </button>
                <div className={cn('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-[14.5px] leading-7 text-muted-foreground text-pretty">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Related({ related }) {
  if (!related?.length) return null;
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Related outcomes</div>
        <h2 className="mt-3 font-serif text-[32px] md:text-[42px] leading-[1.02] tracking-tight text-balance">
          Members who chose this often explored
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {related.map((o) => (
            <Link key={o.slug} href={`/outcomes/${o.slug}`}
              className="group rounded-2xl border border-border bg-card p-8 flex items-start justify-between gap-4 hover:border-foreground/40 hover:-translate-y-0.5 transition-all">
              <div className="flex-1">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand mb-4">
                  <o.icon className="h-4 w-4" />
                </div>
                <div className="font-serif text-[24px] leading-tight text-foreground group-hover:text-brand transition-colors">{o.title}</div>
                <div className="mt-1.5 text-[13.5px] text-muted-foreground">{o.eyebrow}</div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ outcome }) {
  return (
    <section className="relative py-24 md:py-36 overflow-hidden" style={{ background: 'hsl(var(--foreground))' }}>
      <div className="absolute inset-0 opacity-[0.06]"><div className="grid-bg absolute inset-0" /></div>
      <div className="relative max-w-[1240px] mx-auto px-5 md:px-8 text-center">
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'hsl(var(--aurora))' }}>Ready when you are</div>
        <h2 className="mt-4 font-serif text-[44px] md:text-[76px] leading-[1] tracking-tight text-balance" style={{ color: 'hsl(var(--background))' }}>
          Book your first<br />
          <span className="italic">{outcome.title.toLowerCase()}</span> session.
        </h2>
        <p className="mt-6 text-[15.5px] md:text-[17px] leading-8 max-w-[540px] mx-auto" style={{ color: 'hsl(var(--background) / 0.7)' }}>
          Your first session is on us for new members joining this month. Book online or send us a WhatsApp.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/book?outcome=${outcome.slug}`} className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold text-[15px] transition-all hover:brightness-110" style={{ background: 'hsl(var(--aurora))', color: 'hsl(var(--aurora-foreground))' }}>
            Book a session <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="https://wa.me/919916019755" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-12 px-6 rounded-full border font-medium text-[14.5px] transition-colors" style={{ borderColor: 'hsl(var(--background) / 0.2)', color: 'hsl(var(--background))' }}>
            <MessageCircle className="h-4 w-4" /> WhatsApp us
          </a>
        </div>
      </div>
    </section>
  );
}

export default function OutcomeTemplate({ slug }) {
  const outcome = getOutcome(slug);
  const related = getRelated(slug);
  const ref = useRef(null);
  useRise(ref);
  if (!outcome) return null;
  return (
    <div ref={ref} className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-16">
        <Hero outcome={outcome} />
        <FeltResult outcome={outcome} />
        <Science outcome={outcome} />
        <Protocol outcome={outcome} />
        <FirstVisit />
        <Pricing outcome={outcome} />
        <FaqAccordion outcome={outcome} />
        <Related related={related} />
        <FinalCTA outcome={outcome} />
      </main>
      <SiteFooter />
      <StickyBookingBar />
    </div>
  );
}
