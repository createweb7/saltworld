'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Menu, X, Phone, MessageCircle, ArrowRight, ArrowUpRight, Wind, Moon,
  Dumbbell, Activity, Heart, Infinity as InfinityIcon, Sun, Users, Star,
  Sparkles, ChevronDown, MapPin, Instagram, Mail, Clock, Check,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';

/* -------------------------------------------------------------------------- */
/* Content — production copy per approved strategy. No lorem ipsum.           */
/* -------------------------------------------------------------------------- */

const IMG = {
  hero:     'https://images.unsplash.com/photo-1580291339839-e2d207553b81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHw0fHxtaW5pbWFsaXN0JTIwcG9vbHxlbnwwfHx8d2hpdGV8MTc4MzUxMjI5Mnww&ixlib=rb-4.1.0&q=85&w=2400&h=1600&fit=crop',
  featured: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHx3YXRlciUyMHN1cmZhY2V8ZW58MHx8fHdoaXRlfDE3ODM1MTIyNzN8MA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop',
  j1:       'https://images.unsplash.com/photo-1609940170579-60f916a78e56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwYmVkfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
  j2:       'https://images.unsplash.com/photo-1486382630970-831dcf080d6f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxoYW5kcyUyMHJlY292ZXJ5fGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
  j3:       'https://images.unsplash.com/photo-1635425291333-8484fc42dc13?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxjb3VwbGUlMjBzaWxob3VldHRlfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjczfDA&ixlib=rb-4.1.0&q=85&w=1200&h=800&fit=crop',
};

const OUTCOMES = [
  { slug: 'stress-relief',       icon: Wind,         title: 'Stress Relief',        line: 'Forty-five quiet minutes back to yourself.' },
  { slug: 'better-sleep',        icon: Moon,         title: 'Better Sleep',         line: 'Deeper, more consistent nights.' },
  { slug: 'muscle-recovery',     icon: Dumbbell,     title: 'Muscle Recovery',      line: 'Faster reset for athletes and weekend runners.' },
  { slug: 'pain-relief',         icon: Activity,     title: 'Pain Relief',          line: 'Gentle, drug-free relief for chronic pain.' },
  { slug: 'couple-activities',   icon: Heart,        title: 'Couple Activities',    line: 'A shared wellness date, done right.' },
  { slug: 'longevity',           icon: InfinityIcon, title: 'Longevity',            line: 'Small habits, compounded over years.' },
  { slug: 'skin-rejuvenation',   icon: Sun,          title: 'Skin Rejuvenation',    line: 'Red-light protocols for glow and repair.' },
  { slug: 'corporate-wellness',  icon: Users,        title: 'Corporate Wellness',   line: 'Programmes for teams that ship.' },
];

const REVIEWS = [
  { quote: "The team knows me by name. Sunday sessions have become non-negotiable.",         author: 'Rohan Menon',    role: 'Product Manager · Koramangala' },
  { quote: "My five-year-old\u2019s inhaler use is down to almost zero. This place is real.",author: 'Priya Nair',     role: 'Parent · Indiranagar' },
  { quote: "I sleep the same night as my session. I don\u2019t know a faster reset.",         author: 'Sneha Kulkarni', role: 'Founder · HSR Layout' },
];

const JOURNAL = [
  { slug: 'four-weeks-to-deeper-sleep',  cat: 'Better Sleep',      title: 'Four weeks to deeper sleep',           excerpt: 'A short, evidence-led protocol you can start this Sunday.',        img: IMG.j1, date: 'Jun 2026' },
  { slug: 'what-actually-helps-recovery',cat: 'Muscle Recovery',   title: 'What actually helps recovery',         excerpt: 'A running-club member breaks down the stack that worked for her.', img: IMG.j2, date: 'May 2026' },
  { slug: 'the-quiet-date-night',        cat: 'Couple Activities', title: 'The quiet date night you\u2019ve been missing', excerpt: 'Ninety minutes together, without a phone in sight.',            img: IMG.j3, date: 'May 2026' },
];

const NAV_LINKS = [
  { href: '/outcomes/stress-relief', label: 'Outcomes' },
  { href: '/therapies',              label: 'Therapies' },
  { href: '/memberships',            label: 'Memberships' },
  { href: '/journal',                label: 'Journal' },
];

/* -------------------------------------------------------------------------- */
/* Small hooks                                                                */
/* -------------------------------------------------------------------------- */

function useScrolled(threshold = 80) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

/** IntersectionObserver-based reveal for the .rise utility. */
function useRise(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.setAttribute('data-animate', 'in'); });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    el.querySelectorAll('.rise').forEach(n => io.observe(n));
    return () => io.disconnect();
  }, [ref]);
}

/* -------------------------------------------------------------------------- */
/* Nav                                                                        */
/* -------------------------------------------------------------------------- */

function Wordmark({ inverted }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full"
        style={{ background: inverted ? 'rgba(255,255,255,0.15)' : 'hsl(var(--brand))' }}
      >
        <span className="block h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: inverted ? '#fff' : 'hsl(var(--brand-foreground))' }} />
      </span>
      <span className={cn('text-[15px] font-semibold tracking-[0.14em] uppercase', inverted ? 'text-white' : 'text-foreground')}>
        Salt World
      </span>
    </Link>
  );
}

function TopNav() {
  const scrolled = useScrolled(80);
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  const inverted = !scrolled;
  return (
    <>
      <header className={cn(
        'no-print fixed top-0 inset-x-0 z-50 transition-colors duration-300',
        scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-border' : 'bg-transparent'
      )}>
        <div className="max-w-[1240px] mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <Wordmark inverted={inverted} />
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className={cn('text-[13.5px] font-medium tracking-tight transition-colors',
                  inverted ? 'text-white/90 hover:text-white' : 'text-foreground/70 hover:text-foreground'
                )}>{l.label}</Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/gifts" className={cn('text-[13.5px] font-medium transition-colors',
              inverted ? 'text-white/80 hover:text-white' : 'text-foreground/70 hover:text-foreground'
            )}>Gift</Link>
            <Link href="/book" className={cn(
              'inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13.5px] font-semibold transition-all',
              inverted
                ? 'bg-white text-[hsl(165,20%,6%)] hover:bg-white/90'
                : 'bg-foreground text-background hover:bg-foreground/90'
            )}>
              Book <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className={cn('md:hidden h-9 w-9 rounded-full flex items-center justify-center transition-colors',
              inverted ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'
            )}>
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-[60] md:hidden transition-opacity duration-300', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
        <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className={cn('absolute right-0 top-0 bottom-0 w-[86%] max-w-sm bg-background border-l border-border p-6 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex items-center justify-between">
            <Wordmark />
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="mt-10 flex flex-col gap-1">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className="font-serif text-2xl tracking-tight text-foreground py-2">{l.label}</Link>
            ))}
            <Link href="/gifts" onClick={() => setOpen(false)} className="font-serif text-2xl tracking-tight text-foreground py-2">Gifts</Link>
            <Link href="/for-teams" onClick={() => setOpen(false)} className="font-serif text-2xl tracking-tight text-foreground py-2">For teams</Link>
          </nav>
          <div className="mt-auto space-y-2">
            <Link href="/book" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1.5 h-11 rounded-full bg-foreground text-background font-semibold">
              Book a session <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="tel:+919916019755" className="flex items-center justify-center gap-1.5 h-11 rounded-full border border-border text-foreground text-[14px] font-medium">
              <Phone className="h-3.5 w-3.5" /> +91 99160 19755
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden">
      <img
        src={IMG.hero}
        alt="A quiet, sun-lit pool in the Salt World sanctuary"
        className="absolute inset-0 h-full w-full object-cover anim-kenburns"
        fetchPriority="high"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="max-w-[1240px] mx-auto px-5 md:px-8 w-full">
            <div className="max-w-[720px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/90">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--aurora))' }} />
                Bengaluru · Est. 2017
              </div>
              <h1 className="mt-6 font-serif text-white text-[44px] md:text-[76px] leading-[0.98] tracking-tight text-balance">
                What brings you<br />here today?
              </h1>
              <p className="mt-5 text-white/85 text-[16px] md:text-[18px] leading-8 max-w-[520px]">
                A wellness sanctuary designed around the outcome you want &mdash; deeper sleep,
                a quieter mind, a body that recovers faster. Book your first quiet forty-five minutes.
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {['I\u2019m stressed', 'I want better sleep', 'I need recovery', 'Gift someone'].map((chip, i) => (
                  <button key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur px-4 h-10 text-[13.5px] text-white hover:bg-white/20 hover:border-white/40 transition-colors">
                    {chip} <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                  </button>
                ))}
              </div>
              <div className="mt-10 flex items-center gap-4 text-[12.5px] text-white/70">
                <div className="flex items-center gap-1">{[0,1,2,3,4].map(i => <Star key={i} className="h-3.5 w-3.5 fill-current" style={{ color: 'hsl(var(--aurora))' }} />)}</div>
                <span>4.9 · 1,200+ members · Featured in Bangalore Mirror & BioSpectrum</span>
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

/* -------------------------------------------------------------------------- */
/* Outcome selector                                                           */
/* -------------------------------------------------------------------------- */

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
            <Link key={o.slug} href={`/outcomes/${o.slug}`}
              className="rise group relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6 min-h-[168px] md:min-h-[196px] flex flex-col justify-between hover:border-foreground/40 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <o.icon className="h-4 w-4" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <div>
                <div className="font-serif text-[19px] md:text-[22px] leading-tight tracking-tight text-foreground">{o.title}</div>
                <div className="mt-1.5 text-[12.5px] md:text-[13px] leading-5 text-muted-foreground text-pretty">{o.line}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Featured experience                                                        */
/* -------------------------------------------------------------------------- */

function FeaturedExperience() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="relative py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-6 rise">
          <div className="relative aspect-[4/5] md:aspect-[4/5] w-full overflow-hidden rounded-2xl">
            <img src={IMG.featured} alt="Water surface lit by warm morning light" className="absolute inset-0 h-full w-full object-cover anim-kenburns" loading="lazy" />
            <div className="absolute left-4 bottom-4 rounded-full bg-background/90 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/80">
              Featured this month
            </div>
          </div>
        </div>
        <div className="md:col-span-6">
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Float Therapy</div>
          <h3 className="rise mt-3 font-serif text-[38px] md:text-[54px] leading-[1.02] tracking-tight text-balance">
            Weightless.<br />
            <span className="italic">Silent.</span> Restorative.
          </h3>
          <p className="rise mt-5 text-[15.5px] md:text-[16px] leading-8 text-muted-foreground max-w-[520px]">
            Sixty minutes in body-temperature saltwater. No sound, no light, no gravity.
            The nervous system exhales. Sleep improves the same night.
          </p>
          <ul className="rise mt-6 space-y-2.5 text-[14px] leading-6 text-foreground/80">
            {['60 minutes · single or shared cabin', 'Post-float lounge with jasmine tea', 'Best paired with red-light for skin recovery'].map(li => (
              <li key={li} className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                <span>{li}</span>
              </li>
            ))}
          </ul>
          <div className="rise mt-8 flex flex-wrap items-center gap-3">
            <Link href="/therapies/float-therapy" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
              Book a float <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/therapies/float-therapy" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-border text-foreground text-[14px] font-medium hover:bg-background transition-colors">
              How floating works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Membership tease                                                           */
/* -------------------------------------------------------------------------- */

function MembershipTease() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="py-24 md:py-32 bg-background">
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
            ].map(li => (
              <li key={li} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--brand))' }} />
                <span>{li}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rise">
          <div className="relative rounded-2xl border-2 p-8 bg-card" style={{ borderColor: 'hsl(var(--brand))' }}>
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ background: 'hsl(var(--brand))', color: 'hsl(var(--brand-foreground))' }}>
              <Sparkles className="h-3 w-3" /> Most chosen
            </div>
            <div className="text-[11.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Wellness</div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-serif text-[56px] leading-none tracking-tight">&#8377;3,499</div>
              <div className="text-[13px] text-muted-foreground">/ month</div>
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">Billed monthly · cancel anytime</div>
            <ul className="mt-6 space-y-2.5 text-[14px]">
              {[
                '8 sessions across any therapy',
                'Priority slot booking (up to 14 days)',
                '20% off retail & guest passes',
                'Quarterly wellness consult',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                  <span className="text-foreground/85">{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/memberships" className="mt-7 inline-flex items-center justify-center gap-1.5 w-full h-11 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
              See all plans <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

function Reviews() {
  const ref = useRef(null);
  useRise(ref);
  return (
    <section ref={ref} className="py-24 md:py-32" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-[1240px] mx-auto px-5 md:px-8">
        <div className="max-w-[720px]">
          <div className="rise text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Loved in Bengaluru</div>
          <h3 className="rise mt-3 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
            1,200 members. <span className="italic">One quiet room.</span>
          </h3>
        </div>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {REVIEWS.map((r, i) => (
            <figure key={i} className="rise rounded-2xl border border-border bg-card p-7 flex flex-col">
              <div className="flex items-center gap-1">{[0,1,2,3,4].map(k => <Star key={k} className="h-3.5 w-3.5 fill-current" style={{ color: 'hsl(var(--aurora))' }} />)}</div>
              <blockquote className="mt-4 font-serif text-[19px] leading-[1.4] text-foreground text-pretty">&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 pt-4 border-t border-border">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-[12px] font-semibold text-muted-foreground border border-border">
                  {r.author.split(' ').map(x => x[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div className="text-[13.5px] font-medium text-foreground leading-tight">{r.author}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">{r.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-6 text-[12px] text-muted-foreground">
          <span>Featured in</span>
          <span className="font-serif text-[16px] tracking-tight text-foreground/70">Bangalore Mirror</span>
          <span className="font-serif text-[16px] tracking-tight text-foreground/70">BioSpectrum</span>
          <span className="font-serif text-[16px] tracking-tight text-foreground/70 hidden md:inline">Business Standard</span>
          <span className="font-serif text-[16px] tracking-tight text-foreground/70 hidden md:inline">Deccan Herald</span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Journal preview                                                            */
/* -------------------------------------------------------------------------- */

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
          {JOURNAL.map(j => (
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

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                  */
/* -------------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-24 md:py-36 overflow-hidden" style={{ background: 'hsl(var(--foreground))' }}>
      <div className="absolute inset-0 opacity-[0.06]">
        <div className="grid-bg absolute inset-0" />
      </div>
      <div className="relative max-w-[1240px] mx-auto px-5 md:px-8 text-center">
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'hsl(var(--aurora))' }}>Your first visit</div>
        <h3 className="mt-4 font-serif text-[44px] md:text-[76px] leading-[1] tracking-tight text-balance" style={{ color: 'hsl(var(--background))' }}>
          Ready for your first<br />
          <span className="italic">quiet forty-five minutes?</span>
        </h3>
        <p className="mt-6 text-[15.5px] md:text-[17px] leading-8 max-w-[540px] mx-auto" style={{ color: 'hsl(var(--background) / 0.7)' }}>
          Your first session is on us for new members joining this month. Book online or send us a WhatsApp.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/book" className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold text-[15px] transition-all hover:brightness-110" style={{ background: 'hsl(var(--aurora))', color: 'hsl(var(--aurora-foreground))' }}>
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

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-16 md:py-20 grid grid-cols-2 md:grid-cols-12 gap-8 md:gap-6">
        <div className="col-span-2 md:col-span-4">
          <Wordmark />
          <p className="mt-5 text-[13.5px] leading-6 text-muted-foreground max-w-[280px]">
            Bengaluru&rsquo;s wellness sanctuary. Halotherapy, floatation, infrared, cold plunge, and red-light &mdash;
            designed around the outcome you want.
          </p>
          <address className="not-italic mt-6 text-[13px] text-muted-foreground space-y-2">
            <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-0.5" /><span>3rd Floor, 6th Cross, Sector 7,<br />HSR Layout, Bengaluru 560102</span></div>
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><a href="tel:+919916019755" className="hover:text-foreground">+91 99160 19755</a></div>
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><a href="mailto:hello@saltworld.in" className="hover:text-foreground">hello@saltworld.in</a></div>
            <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /><span>Mon &ndash; Sun · 6:00 AM &ndash; 9:00 PM</span></div>
          </address>
        </div>
        {[
          { h: 'Outcomes', l: [['Stress Relief','/outcomes/stress-relief'],['Better Sleep','/outcomes/better-sleep'],['Muscle Recovery','/outcomes/muscle-recovery'],['Couple Activities','/outcomes/couple-activities'],['Skin Rejuvenation','/outcomes/skin-rejuvenation']] },
          { h: 'Therapies', l: [['Float Therapy','/therapies/float-therapy'],['Salt Therapy','/therapies/salt-therapy'],['Infrared Sauna','/therapies/infrared-sauna'],['Cold Plunge','/therapies/cold-plunge'],['Red-light','/therapies/red-light-therapy']] },
          { h: 'Company', l: [['About','/about'],['Journal','/journal'],['Gifts','/gifts'],['For teams','/for-teams'],['Contact','/contact']] },
        ].map(col => (
          <div key={col.h} className="md:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-foreground font-semibold">{col.h}</div>
            <ul className="mt-4 space-y-2.5">{col.l.map(([label, href]) => (
              <li key={href}><Link href={href} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">{label}</Link></li>
            ))}</ul>
          </div>
        ))}
        <div className="md:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-foreground font-semibold">Newsletter</div>
          <p className="mt-4 text-[12.5px] text-muted-foreground">One editorial letter a month. Never a promo.</p>
          <form className="mt-3 flex gap-1" onSubmit={(e) => e.preventDefault()}>
            <input type="email" required placeholder="you@saltworld.in" className="flex-1 min-w-0 h-9 px-3 rounded-full border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" className="h-9 px-3 rounded-full bg-foreground text-background text-[12.5px] font-semibold">Join</button>
          </form>
          <div className="mt-6 flex items-center gap-2">
            <a href="#" aria-label="Instagram" className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"><Instagram className="h-3.5 w-3.5" /></a>
            <a href="https://wa.me/919916019755" aria-label="WhatsApp" className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"><MessageCircle className="h-3.5 w-3.5" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11.5px] text-muted-foreground">
          <div>© {new Date().getFullYear()} Salt World Wellness Concepts · Bengaluru · All rights reserved</div>
          <div className="flex items-center gap-5">
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal/refunds" className="hover:text-foreground">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Sticky booking bar (mobile only)                                           */
/* -------------------------------------------------------------------------- */

function StickyBookingBar() {
  const scrolled = useScrolled(600);
  return (
    <div className={cn(
      'fixed md:hidden inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 transition-transform duration-300',
      scrolled ? 'translate-y-0' : 'translate-y-full'
    )}>
      <div className="rounded-full shadow-xl flex items-center gap-1 p-1" style={{ background: 'hsl(var(--foreground))' }}>
        <a href="tel:+919916019755" aria-label="Call Salt World"
          className="h-11 w-11 rounded-full flex items-center justify-center shrink-0" style={{ color: 'hsl(var(--background))' }}>
          <Phone className="h-4 w-4" />
        </a>
        <Link href="/book" className="flex-1 h-11 rounded-full flex items-center justify-center gap-2 font-semibold text-[14px]" style={{ background: 'hsl(var(--aurora))', color: 'hsl(var(--aurora-foreground))' }}>
          Book a session <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const App = () => (
  <div className="min-h-screen bg-background">
    <TopNav />
    <main>
      <Hero />
      <OutcomeSelector />
      <FeaturedExperience />
      <MembershipTease />
      <Reviews />
      <JournalPreview />
      <FinalCTA />
    </main>
    <SiteFooter />
    <StickyBookingBar />
  </div>
);

export default App;
