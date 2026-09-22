import { TopNav, SiteFooter, WhatsAppFab } from '@/components/site/shell';
import { getSupabase } from '@/lib/supabase';
import { toProduct, toProductCategory } from '@/lib/db-mappers';
import ProductsGrid from './ProductsGrid';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shop',
  description: 'Himalayan salt lamps, therapeutic bath salts and wellness essentials — the same salts we use in-studio, for home.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/products` },
};

async function loadCatalog() {
  const supabase = getSupabase();
  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).order('created_at', { ascending: true }),
    supabase.from('product_categories').select('*').eq('active', true).order('created_at', { ascending: true }),
  ]);
  return {
    products: (productRows || []).map(toProduct),
    categories: (categoryRows || []).map(toProductCategory),
  };
}

export default async function ProductsPage() {
  const { products, categories } = await loadCatalog();

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="max-w-[640px]">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Shop</div>
            <h1 className="mt-3 font-serif text-[38px] md:text-[54px] leading-[1.05] tracking-tight text-balance">
              The salt we use in-studio, for home.
            </h1>
            <p className="mt-5 text-[15.5px] leading-7 text-muted-foreground">
              Himalayan salt lamps, therapeutic bath salts and mineral soaks — sourced the same way as what&rsquo;s in our treatment rooms.
            </p>
          </div>
          <ProductsGrid products={products} categories={categories} />
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
