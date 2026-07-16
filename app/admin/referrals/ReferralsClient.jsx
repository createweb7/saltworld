'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Users, IndianRupee, Gift, Award, Save, Loader2 } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { SimpleTable, Tabs, Field, Input, PrimaryBtn } from '@/components/admin/primitives';
import { formatDate } from '@/lib/date';

async function fetchOne(url) { const r = await fetch(url); if (!r.ok) throw new Error('failed'); return r.json(); }

export default function ReferralsClient({ user }) {
  const [tab, setTab] = useState('overview');
  const stats = useQuery({ queryKey: ['refstats'], queryFn: () => fetchOne('/api/admin/referrals/stats') });
  const cfgRef = useQuery({ queryKey: ['refcfg'],  queryFn: () => fetchOne('/api/admin/settings/referral') });
  const cfgLoy = useQuery({ queryKey: ['loycfg'],  queryFn: () => fetchOne('/api/admin/settings/loyalty')  });

  const cards = [
    { icon: Users,       label: 'Successful referrals',    val: stats.data?.totalReferrals ?? 0 },
    { icon: IndianRupee, label: 'Revenue generated',        val: `₹${(stats.data?.totalRevenue ?? 0).toLocaleString('en-IN')}` },
    { icon: Award,       label: 'Rewards paid out (pts)',    val: (stats.data?.totalRewards ?? 0).toLocaleString('en-IN') },
    { icon: Sparkles,    label: 'Conversion rate',           val: `${((stats.data?.conversionRate ?? 0) * 100).toFixed(1)}%` },
  ];

  return (
    <AdminShell user={user} title="Referrals & Loyalty">
      <PageHeader eyebrow="Growth" title="Referrals & Loyalty" subtitle="Configurable referral engine + points wallet. All customers get a unique code the moment they sign in." />
      <AdminSection>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="h-9 w-9 rounded-lg bg-brand/10 text-brand inline-flex items-center justify-center mb-3"><c.icon className="h-4 w-4" /></div>
              <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">{c.label}</div>
              <div className="mt-1 font-serif text-[26px] leading-none tracking-tight">{c.val}</div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <Tabs items={[
            { key: 'overview',   label: 'Top referrers' },
            { key: 'ref-config', label: 'Referral config' },
            { key: 'loy-config', label: 'Loyalty config' },
          ]} active={tab} onChange={setTab} />
        </div>

        {tab === 'overview'   && <TopReferrers data={stats.data?.topReferrers || []} loading={stats.isLoading} />}
        {tab === 'ref-config' && <ReferralConfig initial={cfgRef.data} onSaved={() => cfgRef.refetch()} />}
        {tab === 'loy-config' && <LoyaltyConfig  initial={cfgLoy.data} onSaved={() => cfgLoy.refetch()} />}
      </AdminSection>
    </AdminShell>
  );
}

function TopReferrers({ data, loading }) {
  const columns = [
    { key: 'name',    label: 'Customer', render: (r) => <div><div className="font-medium text-[13px]">{r.name || 'Guest'}</div><div className="text-[11px] text-muted-foreground font-mono">{r.phone}</div></div> },
    { key: 'count',   label: 'Referrals', render: (r) => <span className="font-mono">{r.count}</span> },
    { key: 'revenue', label: 'Revenue',   render: (r) => <span className="font-mono">₹{Number(r.revenue || 0).toLocaleString('en-IN')}</span> },
    { key: 'rewards', label: 'Points earned', render: (r) => <span className="font-mono">{Number(r.rewards || 0).toLocaleString('en-IN')}</span> },
  ];
  return <SimpleTable columns={columns} rows={data} isLoading={loading} empty="No referrals yet. Every signed-in customer gets a unique code they can share." />;
}

function ReferralConfig({ initial, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (initial) setForm(initial); }, [initial]);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/referral', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success('Referral config saved'); onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  const items = [
    { key: 'referrerReward', label: 'Referrer reward (points)',  hint: 'Given to the person who shared the code' },
    { key: 'refereeReward',  label: 'Referee reward (points)',   hint: 'Given to the new customer' },
    { key: 'minPurchase',    label: 'Minimum purchase (₹)',      hint: 'The referred booking must be at least this large' },
    { key: 'maxReferrals',   label: 'Max referrals per code',    hint: 'Cap per customer per lifetime' },
    { key: 'expiryDays',     label: 'Reward expiry (days)',      hint: '0 = never expires' },
    { key: 'codePrefix',     label: 'Code prefix',               hint: 'e.g. SW; codes look like SWABC123' },
  ];
  return (
    <div className="max-w-[620px] space-y-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Referral system active
      </label>
      {items.map((it) => (
        <Field key={it.key} label={it.label} hint={it.hint}>
          <Input value={form[it.key] ?? ''} onChange={(e) => setForm({ ...form, [it.key]: it.key === 'codePrefix' ? e.target.value.toUpperCase() : e.target.value })} />
        </Field>
      ))}
      <PrimaryBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save referral config</PrimaryBtn>
    </div>
  );
}

function LoyaltyConfig({ initial, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (initial) setForm(initial); }, [initial]);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/loyalty', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success('Loyalty config saved'); onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  const items = [
    { key: 'earnRate',       label: 'Earn rate (points per ₹1)', hint: '1 = customer earns 1 point per ₹1 spent' },
    { key: 'redeemRate',     label: 'Redeem rate (₹ per point)',  hint: '0.1 = 100 points redeem for ₹10' },
    { key: 'maxRedeemPct',   label: 'Max redeem % of booking',    hint: '0.5 = up to 50% of any booking can be paid with points' },
    { key: 'birthdayBonus',  label: 'Birthday bonus (points)',    hint: 'Sent automatically on customer’s birthday' },
    { key: 'expiryDays',     label: 'Point expiry (days)',        hint: '365 = points expire after a year of inactivity' },
  ];
  return (
    <div className="max-w-[620px] space-y-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Loyalty program active
      </label>
      {items.map((it) => (
        <Field key={it.key} label={it.label} hint={it.hint}>
          <Input type="number" step="0.01" value={form[it.key] ?? ''} onChange={(e) => setForm({ ...form, [it.key]: e.target.value })} />
        </Field>
      ))}
      <PrimaryBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save loyalty config</PrimaryBtn>
    </div>
  );
}
