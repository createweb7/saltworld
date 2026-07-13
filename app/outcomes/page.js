import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';
import { OUTCOMES } from '@/lib/outcomes';

export const metadata = {
  title: 'Outcomes · Salt World',
  description:
    'We sell outcomes, not therapies. Ten protocols across sleep, stress, recovery, longevity, skin, and mental wellness.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/outcomes` },
};

export default function OutcomesIndex() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-40 pb-16 md:pb-20 border-b border-border">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
            The Salt World method
          </div>
          <h1 className="mt-3 font-serif text-[44px] md:text-[76px] leading-[1.02] tracking-tight text-balance max-w-[900px]">
            Choose the outcome. <span className="italic">We’ll choose the therapies.</span>
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] leading-[1.55] text-muted-foreground max-w-[640px]">
            Ten distinct protocols, each engineered around a measurable outcome.
            Book once, and we sequence the therapies for you.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {OUTCOMES.map((o) => {
              const Icon = o.icon;
              return (
                <Link
                  key={o.slug}
                  href={`/outcomes/${o.slug}`}
                  className="group rounded-2xl border border-border bg-card p-6 md:p-7 hover:border-foreground/30 transition-colors flex flex-col"
                >
                  <div className="h-11 w-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                  </div>
                  <div className="mt-5 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                    {o.eyebrow}
                  </div>
                  <h2 className="mt-2 font-serif text-[26px] md:text-[30px] leading-[1.05] tracking-tight">
                    {o.title}
                  </h2>
                  <p className="mt-3 text-[14px] leading-[1.55] text-muted-foreground line-clamp-3">
                    {o.hero?.subhead}
                  </p>
                  <div className="mt-5 pt-5 border-t border-border flex items-baseline justify-between text-[12.5px]">
                    <span className="text-muted-foreground">{o.protocol?.duration || '45 min'} · {o.protocol?.primary || 'Guided protocol'}</span>
                    <span className="inline-flex items-center gap-1 font-medium group-hover:gap-1.5 transition-all">
                      Explore <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-16 rounded-3xl bg-card border border-border p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Not sure yet?</div>
              <h3 className="mt-2 font-serif text-[28px] md:text-[36px] leading-[1.05] tracking-tight">
                Talk to a therapist for two minutes.
              </h3>
              <p className="mt-3 text-[14.5px] leading-[1.55] text-muted-foreground max-w-[520px]">
                Tell us what’s going on — sleep, stress, recovery, skin. We’ll suggest the right outcome and book your first visit.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/book" className="h-11 px-5 rounded-full bg-foreground text-background inline-flex items-center gap-1.5 font-semibold text-[14px]">
                Book a session <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="https://wa.me/919916019755" className="h-11 px-5 rounded-full border border-border inline-flex items-center gap-1.5 font-medium text-[14px] hover:bg-muted transition-colors">
                WhatsApp us
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
      <StickyBookingBar />
    </div>
  );
}
