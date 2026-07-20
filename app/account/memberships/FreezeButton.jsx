'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Snowflake, Loader2 } from 'lucide-react';

export default function FreezeButton({ subscriptionId }) {
  const [loading, setLoading] = useState(false);
  const freeze = async () => {
    if (!confirm('Freeze this membership? You can unfreeze it whenever you\'re ready — validity resumes from that day.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customer/subscriptions/${subscriptionId}/freeze`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success('Membership frozen. Talk to reception to unpause.');
      window.location.reload();
    } catch (e) {
      toast.error(e.message === 'freeze_not_allowed' ? 'This plan doesn\'t allow freezing' : 'Could not freeze');
    } finally { setLoading(false); }
  };
  return (
    <button onClick={freeze} disabled={loading}
      className="h-9 px-3.5 rounded-full border border-border bg-card hover:bg-muted text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Snowflake className="h-3.5 w-3.5" />}
      {loading ? 'Freezing…' : 'Freeze membership'}
    </button>
  );
}
