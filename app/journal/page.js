import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';
import { getSupabase } from '@/lib/supabase';

export const metadata = {
  title: 'Blog · Salt World',
  description:
    'Editorial notes on sleep, stress, longevity, floatation, salt therapy and the science of feeling better — from the Salt World team in Bengaluru.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/journal` },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;

async function loadPublishedPosts(page = 1) {
  try {
    const supabase = getSupabase();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: rows, count } = await supabase.from('blog_posts').select('*', { count: 'exact' }).eq('status', 'published').order('created_at', { ascending: false }).range(from, to);
    return {
      posts: (rows || []).map((r) => ({ ...r.data, id: r.id, slug: r.slug, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at })),
      total: count || 0,
    };
  } catch {
    return { posts: [], total: 0 };
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default async function JournalIndex({ searchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.page) || 1);
  const { posts, total } = await loadPublishedPosts(page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-40 pb-14 md:pb-16 border-b border-border">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">The Salt World Blog</div>
          <h1 className="mt-3 font-serif text-[44px] md:text-[76px] leading-[1.02] tracking-tight text-balance max-w-[880px]">
            Notes on <span className="italic">sleep, stress, and feeling human again.</span>
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] leading-[1.55] text-muted-foreground max-w-[640px]">
            Editorial writing from the team — protocols, science, and stories from the sanctuary.
            One thoughtful piece a month, never a promo.
          </p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 md:p-14 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <h3 className="mt-5 font-serif text-[28px] md:text-[34px] leading-[1.05] tracking-tight">
                First issue coming soon.
              </h3>
              <p className="mt-3 text-[14.5px] leading-[1.6] text-muted-foreground max-w-[520px] mx-auto">
                We’re working on the launch of the Salt World Blog — essays on floatation, halotherapy,
                circadian rhythm, and the science of stress. Join the letter to be first to read.
              </p>
              <form className="mt-7 max-w-md mx-auto flex gap-2" action="/api/leads" method="post">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="flex-1 h-11 px-4 rounded-full border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <input type="hidden" name="source" value="journal_notify" />
                <input type="hidden" name="name" value="Blog subscriber" />
                <button className="h-11 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold">
                  Notify me
                </button>
              </form>
            </div>
          ) : (
            <div className="grid gap-8 md:gap-10 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <article key={p.id} className="group">
                  {p.coverUrl ? (
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.coverUrl}
                        alt={p.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-brand/10 to-muted flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-brand/40" />
                    </div>
                  )}
                  <div className="mt-5 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                    {p.category || 'Wellness'} · {formatDate(p.publishedAt || p.createdAt)}
                  </div>
                  <h2 className="mt-2 font-serif text-[24px] md:text-[28px] leading-[1.08] tracking-tight">
                    <Link
                      href={`/journal/${p.slug}`}
                      className="hover:underline underline-offset-4 decoration-2 decoration-brand/40"
                    >
                      {p.title}
                    </Link>
                  </h2>
                  {p.excerpt && (
                    <p className="mt-3 text-[14px] leading-[1.6] text-muted-foreground line-clamp-3">
                      {p.excerpt}
                    </p>
                  )}
                  <Link
                    href={`/journal/${p.slug}`}
                    className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium hover:gap-1.5 transition-all"
                  >
                    Read the essay <ArrowRight className="h-3 w-3" />
                  </Link>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-14 md:mt-20 flex items-center justify-center gap-2" aria-label="Blog pagination">
              <Link
                href={page > 1 ? `/journal?page=${page - 1}` : '#'}
                aria-disabled={page <= 1}
                className={`h-9 px-4 rounded-full border border-border text-[13px] font-medium inline-flex items-center gap-1 transition-colors ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-muted'}`}
              >
                Previous
              </Link>
              <span className="text-[12.5px] text-muted-foreground px-2">Page {page} of {totalPages}</span>
              <Link
                href={page < totalPages ? `/journal?page=${page + 1}` : '#'}
                aria-disabled={page >= totalPages}
                className={`h-9 px-4 rounded-full border border-border text-[13px] font-medium inline-flex items-center gap-1 transition-colors ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-muted'}`}
              >
                Next
              </Link>
            </nav>
          )}
        </div>
      </section>

      <SiteFooter />
      <StickyBookingBar />
    </div>
  );
}
