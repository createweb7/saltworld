'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Play, Loader2 } from 'lucide-react';

export default function UnfreezeButton({ subscriptionId }) {
  const [loading, setLoading] = useState(false);
  const unfreeze = async () => {
    if (!confirm('Unfreeze this membership? Validity resumes from today.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customer/subscriptions/${subscriptionId}/unfreeze`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success('Membership is active again. Ready when you are.');
      window.location.reload();
    } catch (e) {
      toast.error('Could not unfreeze. Please try again or contact reception.');
    } finally { setLoading(false); }
  };
  return (
    <button onClick={unfreeze} disabled={loading}
      className="h-9 px-3.5 rounded-full border border-brand bg-brand text-white hover:bg-brand/90 text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {loading ? 'Unfreezing\u2026' : 'Unfreeze membership'}
    </button>
  );
}
