import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';

export const metadata = {
  title: 'Memberships · Salt World',
  description:
    'Wellness memberships from ₹3,499/month — eight sessions across any therapy, priority booking, retail discounts, and a quarterly wellness consult.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/memberships` },
};

const PLANS = [
  {
    name: 'Reset',
    price: '₹3,499',
    period: '/ month',
    tagline: 'The starter rhythm.',
    sessions: '8 sessions / month',
    features: [
      '8 sessions across any therapy',
      'Priority slot booking (24-hour lead)',
      '15% off retail & guest passes',
      'Wellness log — sleep, mood, HRV',
    ],
    featured: false,
  },
  {
    name: 'Wellness',
    price: '₹5,999',
    period: '/ month',
    tagline: 'Our most-loved plan.',
    sessions: '16 sessions / month',
    features: [
      '16 sessions across any therapy',
      'Priority slot booking (12-hour lead)',
      '20% off retail & guest passes',
      'Quarterly wellness consult with a therapist',
      'Personalised evening ritual',
    ],
    featured: true,
  },
  {
    name: 'Sanctuary',
    price: '₹9,999',
    period: '/ month',
    tagline: 'Unlimited, for the deeply committed.',
    sessions: 'Unlimited (fair-use)',
    features: [
      'Unlimited sessions (fair-use — up to daily)',
      'Guaranteed slot booking (2-hour lead)',
      '25% off retail & guest passes',
      'Monthly 1:1 with a therapist',
      'Bring a partner — 4 guest visits per month',
    ],
    featured: false,
  },
];

const BENEFITS = [
  { title: 'One rhythm, many therapies', body: 'Switch freely between float, salt, sauna, plunge and red-light. Your protocol adapts as you do.' },
  { title: 'Compounding effect',          body: 'Members with 12+ weeks of consistent use report the largest gains — sleep, HRV, mood, skin.' },
  { title: 'No paperwork per visit',      body: 'One conversation on day one. From then on, you walk in, we know exactly what you need.' },
];

export default function MembershipsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-40 pb-16 md:pb-20 border-b border-border">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Memberships</div>
          <h1 className="mt-3 font-serif text-[44px] md:text-[76px] leading-[1.02] tracking-tight text-balance max-w-[900px]">
            Wellness that’s a habit, <span className="italic">not an event.</span>
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] leading-[1.55] text-muted-foreground max-w-[620px]">
            One monthly rhythm. Every therapy. Priority booking, a personalised protocol,
            and a therapist who knows your name.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="grid gap-5 md:gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-6 md:p-8 flex flex-col ${p.featured ? 'border-foreground bg-foreground text-background md:-mt-4 md:mb-4 shadow-xl' : 'border-border bg-card'}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-[10.5px] uppercase tracking-[0.16em] font-semibold ${p.featured ? 'text-background/70' : 'text-muted-foreground'}`}>{p.tagline}</div>
                  {p.featured && (
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background/15 text-[10.5px] font-semibold">
                      <Sparkles className="h-3 w-3" /> Most chosen
                    </span>
                  )}
                </div>
                <h2 className={`mt-3 font-serif text-[32px] md:text-[38px] leading-[1.02] tracking-tight ${p.featured ? '' : ''}`}>{p.name}</h2>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-serif text-[42px] md:text-[48px] tracking-tight">{p.price}</span>
                  <span className={`text-[13px] ${p.featured ? 'text-background/60' : 'text-muted-foreground'}`}>{p.period}</span>
                </div>
                <div className={`mt-1 text-[13px] ${p.featured ? 'text-background/70' : 'text-muted-foreground'}`}>{p.sessions}</div>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-[1.5]">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${p.featured ? 'text-background' : 'text-brand'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/book"
                  className={`mt-8 inline-flex items-center justify-center gap-1.5 h-11 rounded-full text-[14px] font-semibold transition-colors ${p.featured ? 'bg-background text-foreground hover:bg-background/90' : 'bg-foreground text-background hover:bg-foreground/90'}`}
                >
                  Start {p.name.toLowerCase()} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[12.5px] text-muted-foreground">
            All plans include 18% GST. Cancel anytime with a month’s notice · memberships pause for medical reasons.
          </p>
        </div>
      </section>

      <section className="border-t border-border py-16 md:py-24">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="grid md:grid-cols-3 gap-6 md:gap-10">
            {BENEFITS.map((b) => (
              <div key={b.title}>
                <h3 className="font-serif text-[24px] md:text-[28px] leading-[1.1] tracking-tight">{b.title}</h3>
                <p className="mt-3 text-[14.5px] leading-[1.6] text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16 md:py-24 bg-muted/30">
        <div className="max-w-[860px] mx-auto text-center px-5 md:px-8">
          <h3 className="font-serif text-[32px] md:text-[44px] leading-[1.05] tracking-tight">
            Not sure which plan fits?
          </h3>
          <p className="mt-4 text-[15px] md:text-[16px] leading-[1.55] text-muted-foreground max-w-[560px] mx-auto">
            Book a single visit first — we’ll credit it toward your membership if you sign up within seven days.
          </p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <Link href="/book" className="h-11 px-5 rounded-full bg-foreground text-background inline-flex items-center gap-1.5 text-[14px] font-semibold">Book a first visit <ArrowRight className="h-4 w-4" /></Link>
            <a href="https://wa.me/917687878793" className="h-11 px-5 rounded-full border border-border inline-flex items-center gap-1.5 text-[14px] font-medium hover:bg-background transition-colors">WhatsApp us</a>
          </div>
        </div>
      </section>

      <SiteFooter />
      <StickyBookingBar />
    </div>
  );
}
