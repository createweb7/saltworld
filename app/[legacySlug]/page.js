import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { toPage } from '@/lib/db-mappers';
import { PageRenderer, SectionList } from '@/components/ss/renderer';
import { TopNav, SiteFooter, WhatsAppFab } from '@/components/site/shell';
import { GIFT_GUIDES, GIFT_GUIDE_SLUGS } from '@/lib/gift-guides';
import GiftExperienceGrid from '@/components/site/gift-experience-grid';
import GoogleReviewsSection from '@/components/site/google-reviews-section';
import TripAdvisorReviewsSection from '@/components/site/tripadvisor-reviews-section';
import InstagramReels from '@/components/site/instagram-reels';

// Serves CMS pages (app/p/[slug] is the editor-facing path) at the bare
// root URL instead — e.g. /gifts-for-husband-in-bangalore, not
// /p/gifts-for-husband-in-bangalore. This preserves the old site's exact
// SEO URLs with no redirect hop. Lives under the pre-existing [legacySlug]
// segment (shared with [legacySlug]/[legacyId], the old blog-post
// redirect) because Next.js requires every dynamic route at this level of
// the tree to use the same param name. Any single path segment that isn't
// one of the static top-level routes (book, gifts, journal, …) lands here;
// it 404s unless a published `pages` row matches the slug.
async function fetchPage(slug) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  return toPage(row);
}

export async function generateMetadata({ params }) {
  const { legacySlug } = await params;
  const page = await fetchPage(legacySlug);
  if (!page) return { title: 'Not found' };
  const seo = page.seo || {};
  const title = seo.metaTitle || page.title;
  const description = seo.metaDescription || page.description || '';
  return {
    title,
    description,
    alternates: { canonical: seo.canonical || `https://saltworld.in/${legacySlug}` },
    openGraph: {
      title, description,
      images: seo.ogImage ? [{ url: seo.ogImage }] : undefined,
      url: seo.canonical,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title, description,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
  };
}

export default async function RootCmsPage({ params }) {
  const { legacySlug } = await params;
  const page = await fetchPage(legacySlug);
  if (!page) notFound();

  const isGiftGuide = GIFT_GUIDE_SLUGS.has(legacySlug);
  // On gift-guide pages, the written copy sections run after the packages
  // grid and reviews, not right under the hero — everything else keeps the
  // normal top-to-bottom section order.
  const heroSections = isGiftGuide ? (page.sections || []).filter((s) => s.type === 'hero') : null;
  const copySections = isGiftGuide ? (page.sections || []).filter((s) => s.type !== 'hero') : null;

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-16">
        {isGiftGuide ? (
          <>
            <SectionList sections={heroSections} />
            <GiftExperienceGrid />
            <GoogleReviewsSection />
            <TripAdvisorReviewsSection />
            <InstagramReels />
            <SectionList sections={copySections} />
            <MoreGiftGuides currentSlug={legacySlug} />
          </>
        ) : (
          <PageRenderer page={page} />
        )}
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}

function MoreGiftGuides({ currentSlug }) {
  const others = GIFT_GUIDES.filter((g) => g.slug !== currentSlug);
  return (
    <section className="py-14 md:py-20 border-t border-border" style={{ background: 'hsl(var(--muted))' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          <Gift className="h-3.5 w-3.5" /> More gift guides
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {others.map((g) => (
            <Link key={g.slug} href={`/${g.slug}`}
              className="group inline-flex items-center gap-1 h-9 px-3.5 rounded-full border border-border bg-card text-[13px] font-medium hover:border-foreground/30 transition-colors">
              {g.label}
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
