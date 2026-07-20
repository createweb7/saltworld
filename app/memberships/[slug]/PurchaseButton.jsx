'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function PurchaseButton({ plan }) {
  const [loading, setLoading] = useState(false);

  const purchase = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/memberships/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, paymentMethod: 'online' }),
      });
      const j = await res.json();
      if (res.status === 401) {
        window.location.assign('/account/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }
      if (!res.ok || !j.ok) throw new Error(j.error || 'purchase_failed');
      toast.success(`${plan.name} activated!`);
      window.location.assign('/account/memberships');
    } catch (e) {
      toast.error('Could not complete purchase. Please try again or contact reception.');
    } finally { setLoading(false); }
  };

  return (
    <button
      onClick={purchase}
      disabled={loading}
      className="h-12 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-60">
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Activating…</> : <>Get this plan <ArrowRight className="h-4 w-4" /></>}
    </button>
  );
}
