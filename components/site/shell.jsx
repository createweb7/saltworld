'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Menu, X, Phone, MessageCircle, ArrowRight, MapPin, Instagram, Mail, Clock,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useScrolled(threshold = 80) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

/** IntersectionObserver-based reveal for the .rise utility. */
export function useRise(ref) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-animate', 'in'); });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    el.querySelectorAll('.rise').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [ref]);
}

/* ------------------------------------------------------------------ */
/* Wordmark  — official Salt World logo (SVG)                         */
/* ------------------------------------------------------------------ */

export function Logomark({ size = 32, inverted = false, className }) {
  // Circle = brand teal on light, white on hero-inverted contexts.
  // Waves = the surface color (bone / white).
  const disc = inverted ? '#ffffff' : 'hsl(var(--brand))';
  const wave = inverted ? 'hsl(var(--brand))' : 'hsl(var(--background))';
  return (
    <svg
      viewBox="0 0 40 40" width={size} height={size} aria-hidden="true"
      className={className} role="img" focusable="false"
    >
      <defs>
        <clipPath id="sw-clip"><circle cx="20" cy="20" r="19.5" /></clipPath>
      </defs>
      <circle cx="20" cy="20" r="19.5" fill={disc} />
      <g clipPath="url(#sw-clip)" fill="none" stroke={wave} strokeWidth="3.6" strokeLinecap="round">
        <path d="M-4 13 Q6 8 14 12 T30 11 T44 13" />
        <path d="M-4 22 Q6 17 14 21 T30 20 T44 22" />
        <path d="M-4 31 Q6 26 14 30 T30 29 T44 31" />
      </g>
    </svg>
  );
}

export function Wordmark({ inverted }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Salt World — home">
      <Logomark size={30} inverted={inverted} />
      <span className={cn(
        'text-[13.5px] font-semibold tracking-[0.22em] uppercase',
        inverted ? 'text-white' : 'text-foreground'
      )}>
        Salt World<span className="align-super text-[0.55em] ml-0.5">®</span>
      </span>
    </Link>
  );
}

const NAV_LINKS = [
  { href: '/outcomes/stress-relief', label: 'Outcomes' },
  { href: '/therapies',              label: 'Therapies' },
  { href: '/memberships',            label: 'Memberships' },
  { href: '/journal',                label: 'Journal' },
];

/* ------------------------------------------------------------------ */
/* Top Nav                                                            */
/* ------------------------------------------------------------------ */

export function TopNav({ transparentHero = true }) {
  const scrolled = useScrolled(80);
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  const inverted = transparentHero && !scrolled;
  return (
    <>
      <header className={cn(
        'no-print fixed top-0 inset-x-0 z-50 transition-colors duration-300',
        scrolled || !transparentHero
          ? 'bg-background/85 backdrop-blur-xl border-b border-border'
          : 'bg-transparent'
      )}>
        <div className="max-w-[1240px] mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <Wordmark inverted={inverted} />
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
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

      <div className={cn('fixed inset-0 z-[60] md:hidden transition-opacity duration-300',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
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
            {NAV_LINKS.map((l) => (
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

/* ------------------------------------------------------------------ */
/* Footer                                                             */
/* ------------------------------------------------------------------ */

export function SiteFooter() {
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
        ].map((col) => (
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

/* ------------------------------------------------------------------ */
/* Sticky mobile booking bar                                          */
/* ------------------------------------------------------------------ */

export function StickyBookingBar({ threshold = 600 }) {
  const scrolled = useScrolled(threshold);
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
