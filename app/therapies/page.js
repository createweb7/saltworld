import Link from 'next/link';
import { ArrowRight, Wind, Waves, Flame, Snowflake, Sunrise } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';
import { OUTCOMES } from '@/lib/outcomes';

export const metadata = {
  title: 'Therapies · Salt World',
  description:
    'Five modalities under one roof — halotherapy, floatation, infrared sauna, cold plunge, and red-light therapy. Sequenced for a specific outcome.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/therapies` },
};

const THERAPIES = [
  {
    slug: 'salt-therapy',
    label: 'Halotherapy',
    tagline: 'Dry salt for lungs, skin and calm.',
    body:
      'A pharmaceutical-grade halogenerator disperses ultra-fine dry salt into a heated micro-climate. Forty-five minutes of breathing this air soothes airways, calms the sympathetic nervous system, and clears the skin.',
    icon: Wind,
    duration: '45 minutes',
    goodFor: ['Stress Relief', 'Respiratory Wellness', 'Skin Rejuvenation'],
  },
  {
    slug: 'float-therapy',
    label: 'Float Therapy',
    tagline: 'Ten inches of body-temperature water. Zero gravity.',
    body:
      'Suspended in half a tonne of dissolved magnesium at body temperature, sensory input drops to almost nothing. The brain drifts into a theta state within twenty minutes. Deeper than the deepest meditation.',
    icon: Waves,
    duration: '60 minutes',
    goodFor: ['Mental Wellness', 'Muscle Recovery', 'Better Sleep'],
  },
  {
    slug: 'infrared-sauna',
    label: 'Infrared Sauna',
    tagline: 'Deep-heat cellular reset.',
    body:
      'Far-infrared light warms tissue directly, without heating the air. Core temperature rises gently, heart rate follows, and the body cycles through a passive cardiovascular workout. Excellent for recovery and longevity protocols.',
    icon: Flame,
    duration: '35 minutes',
    goodFor: ['Muscle Recovery', 'Longevity', 'Detox'],
  },
  {
    slug: 'cold-plunge',
    label: 'Cold Plunge',
    tagline: 'Two minutes at 10°C. A week of resilience.',
    body:
      'Cold exposure triggers a controlled adrenaline release, followed hours later by a durable mood-lift. Paired with sauna, it accelerates recovery, strengthens immunity, and re-calibrates stress response.',
    icon: Snowflake,
    duration: '2 – 4 minutes',
    goodFor: ['Muscle Recovery', 'Longevity', 'Pain Relief'],
  },
  {
    slug: 'red-light-therapy',
    label: 'Red-light Therapy',
    tagline: 'Photobiomodulation for skin and mitochondria.',
    body:
      'Specific wavelengths of red and near-infrared light stimulate mitochondrial ATP production. Skin becomes brighter within weeks, and inflammation calms across joints and muscles.',
    icon: Sunrise,
    duration: '20 minutes',
    goodFor: ['Skin Rejuvenation', 'Pain Relief', 'Longevity'],
  },
];

function outcomesUsing(slug) {
  return OUTCOMES.filter((o) => o.protocol?.therapies?.some((t) => t.slug === slug));
}

export default function TherapiesIndex() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-40 pb-16 md:pb-20 border-b border-border">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">The five modalities</div>
          <h1 className="mt-3 font-serif text-[44px] md:text-[76px] leading-[1.02] tracking-tight text-balance max-w-[900px]">
            Five ways to soften the day. <span className="italic">Sequenced by outcome.</span>
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] leading-[1.55] text-muted-foreground max-w-[640px]">
            You never book a therapy in isolation. Every visit is prescribed around
            an outcome — the modalities below are the tools we combine to get you there.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8 space-y-12 md:space-y-16">
          {THERAPIES.map((t, idx) => {
            const outcomes = outcomesUsing(t.slug);
            const Icon = t.icon;
            return (
              <div key={t.slug} className="grid md:grid-cols-12 gap-8 md:gap-10 items-start">
                <div className="md:col-span-4">
                  <div className="h-14 w-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-5 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                    {String(idx + 1).padStart(2, '0')} · {t.duration}
                  </div>
                  <h2 className="mt-2 font-serif text-[34px] md:text-[42px] leading-[1.03] tracking-tight">
                    {t.label}
                  </h2>
                  <div className="mt-2 font-serif italic text-[18px] text-muted-foreground">
                    {t.tagline}
                  </div>
                </div>
                <div className="md:col-span-8">
                  <p className="text-[15.5px] md:text-[16.5px] leading-[1.6] text-foreground/90">
                    {t.body}
                  </p>
                  {outcomes.length > 0 && (
                    <div className="mt-6">
                      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Prescribed within</div>
                      <div className="flex flex-wrap gap-2">
                        {outcomes.map((o) => (
                          <Link
                            key={o.slug}
                            href={`/outcomes/${o.slug}`}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border text-[13px] font-medium hover:bg-muted transition-colors"
                          >
                            {o.title} <ArrowRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border py-16 md:py-24 bg-muted/30">
        <div className="max-w-[900px] mx-auto text-center px-5 md:px-8">
          <h3 className="font-serif text-[32px] md:text-[44px] leading-[1.05] tracking-tight">
            Tell us where you’d like to arrive.
          </h3>
          <p className="mt-4 text-[15px] md:text-[16px] leading-[1.55] text-muted-foreground max-w-[560px] mx-auto">
            We’ll pick the sequence, book the room, and prep the ritual.
          </p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <Link href="/outcomes" className="h-11 px-5 rounded-full border border-border text-[14px] font-medium hover:bg-background transition-colors">Browse outcomes</Link>
            <Link href="/book" className="h-11 px-5 rounded-full bg-foreground text-background inline-flex items-center gap-1.5 text-[14px] font-semibold">Book a session <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <SiteFooter />
      <StickyBookingBar />
    </div>
  );
}
