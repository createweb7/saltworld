import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { toPage } from '@/lib/db-mappers';
import { PageRenderer } from '@/components/ss/renderer';

async function fetchPage(slug) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  return toPage(row);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) return { title: 'Not found' };
  const seo = page.seo || {};
  const title = seo.metaTitle || page.title;
  const description = seo.metaDescription || page.description || '';
  return {
    title,
    description,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
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

export default async function PublicPage({ params }) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) notFound();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageRenderer page={page} />
      <footer className="py-8 border-t border-border text-center text-[12.5px] text-muted-foreground">
        © Salt World · Bengaluru
      </footer>
    </div>
  );
}
