import { notFound } from 'next/navigation';
import { getOutcome } from '@/lib/outcomes';
import { getSupabase } from '@/lib/supabase';
import { toTherapy } from '@/lib/db-mappers';
import { TopNav, SiteFooter, WhatsAppFab } from '@/components/site/shell';
import GiftPurchaseClient from './GiftPurchaseClient';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const outcome = getOutcome(slug);
  if (!outcome) return { title: 'Not found' };
  return {
    title: `Gift ${outcome.title}`,
    description: `Gift the ${outcome.title} experience at Salt World — pick one or several therapies, add a personal note, and send it (or print it) yourself.`,
    alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/gift/${slug}` },
  };
}

export default async function GiftExperiencePage({ params }) {
  const { slug } = await params;
  const outcome = getOutcome(slug);
  if (!outcome) notFound();

  const therapies = outcome.protocol?.therapies || [];
  const supabase = getSupabase();
  const { data: rows } = await supabase.from('therapies').select('*').in('slug', therapies.map((t) => t.slug));
  const therapyMeta = Object.fromEntries((rows || []).map((r) => { const t = toTherapy(r); return [t.slug, t]; }));

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Gift an experience</div>
          <h1 className="mt-3 font-serif text-[36px] md:text-[52px] leading-[1.05] tracking-tight text-balance">
            Gift {outcome.title}
          </h1>
          <p className="mt-4 text-[15px] text-muted-foreground max-w-[560px]">{outcome.hero?.subhead || outcome.eyebrow}</p>
          <GiftPurchaseClient outcome={{ slug: outcome.slug, title: outcome.title }} therapies={therapies} therapyMeta={therapyMeta} />
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
