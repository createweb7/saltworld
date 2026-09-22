import { permanentRedirect, notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

// Preserves the legacy site's blog URLs exactly (`/<slug>/<id>`, no `/blog`
// prefix — that's how the old CodeIgniter site served posts) as permanent
// redirects into the new `/journal/<slug>` pages, so existing search
// rankings and backlinks carry over instead of breaking. Looked up by the
// numeric legacy id (stamped on each row during migration), not the slug
// text, so it's immune to any slug drift between the two systems.
export default async function LegacyBlogRedirect({ params }) {
  const { legacyId } = await params;
  if (!/^\d+$/.test(legacyId)) notFound();

  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('data->>legacyBlogId', legacyId)
    .eq('status', 'published')
    .maybeSingle();

  if (!row) notFound();
  permanentRedirect(`/journal/${row.slug}`);
}
