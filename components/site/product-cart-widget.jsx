'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/components/ss/utils';
import { getCart, cartCount } from '@/lib/product-cart';

export default function ProductCartWidget({ inverted = false }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(cartCount(getCart()));
    const onChange = (e) => setCount(cartCount(e.detail || getCart()));
    window.addEventListener('sw-cart-change', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('sw-cart-change', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Shop cart, ${count} item${count > 1 ? 's' : ''}` : 'Shop cart'}
      className={cn(
        'relative inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors',
        inverted ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'
      )}
    >
      <ShoppingCart className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
