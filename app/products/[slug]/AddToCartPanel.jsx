'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Check } from 'lucide-react';
import { addToCart } from '@/lib/product-cart';

export default function AddToCartPanel({ product }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const outOfStock = (product.stock || 0) <= 0;

  const add = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const buyNow = () => {
    addToCart(product, qty);
    router.push('/cart');
  };

  if (outOfStock) {
    return (
      <div className="mt-6 h-11 px-5 rounded-full border border-border text-[13.5px] font-medium text-muted-foreground inline-flex items-center justify-center w-full sm:w-auto sm:min-w-[220px]">
        Out of stock
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-full border border-border h-11">
        <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-10 inline-flex items-center justify-center hover:bg-muted rounded-l-full">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-8 text-center text-[14px] font-medium">{qty}</span>
        <button aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))} className="h-11 w-10 inline-flex items-center justify-center hover:bg-muted rounded-r-full">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <button onClick={add} className="h-11 px-5 rounded-full border border-border text-[13.5px] font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1.5">
        {added ? <><Check className="h-3.5 w-3.5" /> Added</> : 'Add to cart'}
      </button>
      <button onClick={buyNow} className="h-11 px-5 rounded-full bg-foreground text-background text-[13.5px] font-semibold hover:bg-foreground/90 transition-colors">
        Buy now
      </button>
    </div>
  );
}
