import Link from 'next/link';
import { ArrowRight, Gift as GiftIcon } from 'lucide-react';
import { OUTCOMES } from '@/lib/outcomes';
import { formatINR } from '@/lib/gift-designs';
import GiftCardPreview from '@/components/site/gift-card-preview';

// Live gift-package grid for the SEO gift-guide pages (app/[legacySlug]/page.js).
// Pulls straight from the same OUTCOMES pricing data the main /gifts page uses,
// so the packages and prices shown here can never drift from what's actually
// bookable — no pricing is hardcoded into page copy anywhere.
const GIFTABLE_OUTCOMES = OUTCOMES.filter((o) =>
  [o.pricing?.single, o.pricing?.pack, o.pricing?.membership].some((t) => t && Number(String(t.price).replace(/[^\d]/g, '')) > 0)
);

export default function GiftExperienceGrid({ title = 'Gift a specific experience', subtitle = 'Pick an outcome and gift that full journey — the recipient books their own date and time.' }) {
  return (
    <section className="py-14 md:py-20 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold inline-flex items-center gap-2">
              <GiftIcon className="h-3.5 w-3.5" /> Gift packages
            </div>
            <h2 className="mt-3 font-serif text-[32px] md:text-[40px] leading-[1.05] tracking-tight text-balance">{title}</h2>
            <p className="mt-3 text-[14px] text-muted-foreground max-w-[460px]">{subtitle}</p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="md:col-span-5 md:sticky md:top-28">
            <GiftCardPreview designId="halite" amount={2500} occasion="Birthday" size="lg" className="mx-auto" />
            <div className="mt-5 text-center">
              <Link href="/gifts" className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors">
                Or gift any amount <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-2 text-[11.5px] text-muted-foreground">Any amount from ₹500 · issued instantly · valid 12 months</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
