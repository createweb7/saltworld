'use client';

// Header auth affordance — shows "Sign in" when signed-out, and an avatar +
// dropdown (My account · Memberships · Wallet · Refer · Sign out) when signed in.
//
// Customer identity comes from CustomerProvider (root layout reads the
// session cookie server-side), so it's correct on first paint — no
// client-side fetch/loading flash. Works in both dark (hero) and light nav
// variants via the `inverted` prop.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { User, LogOut, Wallet, ClipboardList, Users, LogIn, ChevronDown, Package, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomer } from '@/components/site/customer-context';

export default function AuthWidget({ inverted = false }) {
  const customer = useCustomer();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    try { await fetch('/api/customer/auth/logout', { method: 'POST' }); }
    finally { window.location.assign('/'); }
  };

  if (!customer) {
    return (
      <Link href="/account/login"
        className={cn('inline-flex items-center gap-1.5 text-[13.5px] font-medium transition-colors',
          inverted ? 'text-white/80 hover:text-white' : 'text-foreground/70 hover:text-foreground'
        )}>
        <LogIn className="h-3.5 w-3.5" /> Sign in
      </Link>
    );
  }

  const initial = (customer.name || customer.email || customer.phone || 'M').slice(0, 1).toUpperCase();
  const displayName = customer.name || (customer.email ? customer.email.split('@')[0] : `+${customer.phone}`);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-full transition-colors',
          inverted ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'
        )}
      >
        {customer.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={customer.picture} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className={cn('h-7 w-7 rounded-full inline-flex items-center justify-center font-serif text-[13px]',
            inverted ? 'bg-white/20 text-white' : 'bg-brand/10 text-brand')}>{initial}</span>
        )}
        <span className="hidden lg:inline text-[13px] font-medium truncate max-w-[120px]">{displayName}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Signed in as</div>
            <div className="mt-0.5 font-medium text-[14px] truncate">{customer.name || 'Member'}</div>
            <div className="text-[11.5px] text-muted-foreground font-mono truncate">
              {customer.email || `+${customer.phone}`}
            </div>
          </div>
          <MenuItem href="/account"             icon={User}         label="My account" />
          <MenuItem href="/account/memberships" icon={ClipboardList} label="Memberships" />
          <MenuItem href="/account/orders"      icon={Package}       label="My orders" />
          <MenuItem href="/account/gifts"       icon={Gift}          label="Gifts sent" />
          <MenuItem href="/account/wallet"      icon={Wallet}        label="Wallet & credits" />
          <MenuItem href="/account/referrals"   icon={Users}         label="Refer friends" />
          <div className="border-t border-border">
            <button onClick={signOut} className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-[13px] font-medium text-red-600 hover:bg-red-500/5 transition-colors">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, icon: Icon, label }) {
  return (
    <Link href={href} className="px-4 py-2.5 flex items-center gap-2.5 text-[13px] font-medium hover:bg-muted transition-colors">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
    </Link>
  );
}
