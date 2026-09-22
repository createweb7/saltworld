import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Truck, RotateCcw, ShieldCheck, Phone } from 'lucide-react';
import { TopNav, SiteFooter, WhatsAppFab } from '@/components/site/shell';
import { getSupabase } from '@/lib/supabase';
import { toProduct } from '@/lib/db-mappers';
import AddToCartPanel from './AddToCartPanel';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadProduct(slugOrId) {
  const supabase = getSupabase();
  const query = supabase.from('products').select('*').eq('active', true);
  const { data: row } = UUID_RE.test(slugOrId)
    ? await query.eq('id', slugOrId).maybeSingle()
    : await query.eq('data->>slug', slugOrId).maybeSingle();
  return toProduct(row);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await loadProduct(slug);
  if (!p) return { title: 'Not found' };
  const title = `${p.name} · Shop`;
  const description = p.shortDescription || p.name;
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/products/${slug}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: p.images?.[0] ? [{ url: p.images[0], alt: p.name }] : undefined },
  };
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8">
          <Link href="/products" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to shop
          </Link>

          <div className="mt-6 grid md:grid-cols-2 gap-10 md:gap-14">
            <div>
              <div className="aspect-square rounded-2xl bg-muted overflow-hidden">
                {product.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              {product.images?.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {product.images.slice(1, 6).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt={product.name} className="aspect-square rounded-lg object-cover bg-muted" />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h1 className="font-serif text-[30px] md:text-[38px] leading-[1.1] tracking-tight text-balance">{product.name}</h1>
              {product.shortDescription && product.shortDescription !== product.name && (
                <p className="mt-2 text-[14.5px] text-muted-foreground">{product.shortDescription}</p>
              )}
              <div className="mt-5 text-[24px] font-semibold">₹{Number(product.price || 0).toLocaleString('en-IN')}</div>

              <AddToCartPanel product={product} />

              <div className="mt-8 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px] text-muted-foreground">
                <div className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 shrink-0" /> Delivery across India</div>
                <div className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 shrink-0" /> Easy returns</div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> 100% secure payments</div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /> Order on call +91 76878 78793</div>
              </div>

              {product.description && (
                <div
                  className="prose prose-sm max-w-none mt-8 pt-8 border-t border-border text-[14px] leading-[1.75] text-foreground/85 [&_p]:m-0 [&_p+p]:mt-3"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
