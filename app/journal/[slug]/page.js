import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function loadPost(slug) {
  try {
    const supabase = getSupabase();
    const { data: row } = await supabase.from('blog_posts').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (!row) return null;
    return { ...row.data, id: row.id, slug: row.slug, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await loadPost(slug);
  if (!p) return { title: 'Not found · Salt World Journal' };
  const title = `${p.title} · Salt World Journal`;
  const description = p.excerpt || p.title;
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/journal/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, type: 'article',
      images: p.coverUrl ? [{ url: p.coverUrl, alt: p.title }] : undefined,
    },
  };
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default async function JournalPost({ params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <article className="pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[760px] mx-auto px-5 md:px-8">
          <Link href="/journal" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to the journal
          </Link>
          <div className="mt-6 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            {post.category || 'Wellness'} · {formatDate(post.publishedAt || post.createdAt)}
          </div>
          <h1 className="mt-3 font-serif text-[38px] md:text-[54px] leading-[1.05] tracking-tight text-balance">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 text-[17px] md:text-[19px] leading-[1.55] text-muted-foreground">
              {post.excerpt}
            </p>
          )}
          {post.coverUrl && (
            <div className="mt-8 md:mt-10 rounded-2xl overflow-hidden aspect-[16/9] bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverUrl} alt={post.title} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="prose prose-lg max-w-none mt-8 md:mt-10 [&_h2]:font-serif [&_h2]:mt-8 [&_h3]:font-serif [&_h3]:mt-6 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_img]:rounded-xl [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted/40 [&_td]:border [&_td]:border-border [&_td]:p-2 text-[16.5px] md:text-[17.5px] leading-[1.75] text-foreground/90"
               dangerouslySetInnerHTML={{ __html: post.body || '' }} />
          {post.author && (
            <div className="mt-10 pt-8 border-t border-border text-[13px] text-muted-foreground">
              Written by <span className="text-foreground font-medium">{post.author}</span>
            </div>
          )}
        </div>
      </article>

      <section className="border-t border-border py-14 md:py-20 bg-muted/30">
        <div className="max-w-[860px] mx-auto text-center px-5 md:px-8">
          <h3 className="font-serif text-[28px] md:text-[36px] leading-[1.06] tracking-tight">
            Ready to feel it, not just read about it?
          </h3>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
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
