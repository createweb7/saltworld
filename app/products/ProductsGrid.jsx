'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PackageX } from 'lucide-react';
import { cn } from '@/components/ss/utils';

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function ProductsGrid({ products, categories }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return products;
    return products.filter((p) => p.categoryId === activeCategory);
  }, [products, activeCategory]);

  return (
    <div className="mt-10 md:mt-14">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={cn(
            'h-9 px-4 rounded-full border text-[13px] font-medium transition-colors',
            activeCategory === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground hover:bg-muted'
          )}
        >
          All ({products.length})
        </button>
        {categories.map((c) => {
          const count = products.filter((p) => p.categoryId === c.id).length;
          if (count === 0) return null;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                'h-9 px-4 rounded-full border text-[13px] font-medium transition-colors',
                activeCategory === c.id ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground hover:bg-muted'
              )}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center text-muted-foreground text-[14px]">Nothing in this category yet.</div>
      ) : (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.slug || p.id}`}
              className="group rounded-2xl border border-border bg-background overflow-hidden hover:border-foreground/30 transition-colors"
            >
              <div className="aspect-square bg-muted relative overflow-hidden">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <PackageX className="h-6 w-6" />
                  </div>
                )}
                {p.stock <= 0 && (
                  <div className="absolute inset-x-0 bottom-0 bg-foreground/85 text-background text-[10.5px] font-semibold uppercase tracking-[0.12em] text-center py-1.5">
                    Out of stock
                  </div>
                )}
              </div>
              <div className="p-3.5">
                <div className="text-[13px] font-medium leading-snug line-clamp-2">{p.name}</div>
                <div className="mt-1.5 text-[13.5px] font-semibold">{formatINR(p.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
