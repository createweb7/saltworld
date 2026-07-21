'use client';

// Admin → Coupons
// Influencer/marketing campaign codes. Two-tab UI:
//   • Coupons  — CRUD list + drawer editor.
//   • Reports  — aggregate performance per code + influencer.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, TrendingUp, IndianRupee, Percent, Copy } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection, Tabs } from '@/components/admin/shell';
import {
  SimpleTable, Drawer, Field, Input, Textarea, Select, Toggle,
  PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';

const TABS = [
  { key: 'coupons', label: 'Coupons' },
  { key: 'reports', label: 'Reports' },
];

async function fetchCoupons()  { const r = await fetch('/api/admin/coupons');           return r.ok ? r.json() : []; }
async function fetchReport()   { const r = await fetch('/api/admin/coupons/report');    return r.ok ? r.json() : null; }
async function fetchTherapies(){ const r = await fetch('/api/admin/services/therapies');return r.ok ? r.json() : []; }
async function fetchBranches() { const r = await fetch('/api/admin/branches');          return r.ok ? r.json() : []; }

export default function CouponsClient({ user }) {
  const [tab, setTab] = useState('coupons');
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  return (
    <AdminShell user={user} title="Coupons" actions={tab === 'coupons' ? (
      <PrimaryBtn onClick={() => setEditing({})} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New coupon</PrimaryBtn>
    ) : null}>
      <PageHeader eyebrow="Marketing" title="Coupons & Influencer Codes" subtitle="Discount codes for campaigns and creator partnerships. Track conversions and revenue per code." />
      <AdminSection>
        <div className="mb-4"><Tabs items={TABS} active={tab} onChange={setTab} /></div>
        {tab === 'coupons' && <CouponsList onEdit={setEditing} />}
        {tab === 'reports' && <CouponsReport />}
      </AdminSection>

      {editing !== null && (
        <CouponEditor coupon={editing} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ['admin-coupons'] }); qc.invalidateQueries({ queryKey: ['admin-coupons-report'] }); setEditing(null); }} />
      )}
    </AdminShell>
  );
}

function CouponsList({ onEdit }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-coupons'], queryFn: fetchCoupons });

  const remove = async (row) => {
    if (!confirm(`Delete coupon '${row.code}'? Redemptions history is preserved.`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    } catch { toast.error('Could not delete'); }
  };

  const copy = (code) => { navigator.clipboard.writeText(code); toast.success('Copied'); };

  const cols = [
    { key: 'code', label: 'Code', render: (r) => (
      <button onClick={() => copy(r.code)} className="font-mono text-[12.5px] font-semibold uppercase tracking-wide hover:text-brand inline-flex items-center gap-1">
        {r.code}<Copy className="h-3 w-3 opacity-60" />
      </button>
    )},
    { key: 'influencer', label: 'Influencer / Campaign', render: (r) => (
      <div>
        <div className="text-[12.5px] font-medium">{r.influencerName || <span className="text-muted-foreground italic">—</span>}</div>
        {r.campaign && <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{r.campaign}</div>}
      </div>
    )},
    { key: 'discount', label: 'Discount', render: (r) => (
      <div className="font-mono text-[12.5px]">
        {r.discountType === 'percent' ? <>{r.discountValue}%<span className="text-muted-foreground">{r.maxDiscountInr ? ` (max ₹${r.maxDiscountInr})` : ''}</span></> : <>₹{r.discountValue}</>}
      </div>
    )},
    { key: 'window', label: 'Valid', render: (r) => (
      <div className="text-[11.5px] text-muted-foreground">
        {r.endsAt ? <>till {new Date(r.endsAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</> : 'No expiry'}
      </div>
    )},
    { key: 'usage', label: 'Usage', render: (r) => (
      <div className="text-[12px] text-muted-foreground">
        <span className="text-foreground font-semibold">{r.totalRedemptions}</span>{r.usageLimit > 0 ? ` / ${r.usageLimit}` : ''}
      </div>
    )},
    { key: 'revenue', label: 'Revenue', render: (r) => <span className="font-mono text-[12.5px]">₹{Number(r.totalRevenueInr || 0).toLocaleString('en-IN')}</span> },
    { key: 'active',  label: 'Status', render: (r) => r.active
      ? <span className="inline-flex items-center h-5 px-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10.5px] font-semibold uppercase tracking-[0.12em]">Active</span>
      : <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted text-muted-foreground text-[10.5px] font-semibold uppercase tracking-[0.12em]">Inactive</span>
    },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="h-7 w-7 rounded-md hover:bg-muted inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return <SimpleTable columns={cols} rows={data} isLoading={isLoading} empty="No coupons yet. Click ‘New coupon’ to create one." onRowClick={(r) => onEdit(r)} />;
}

function CouponsReport() {
  const { data } = useQuery({ queryKey: ['admin-coupons-report'], queryFn: fetchReport });
  const summary = useMemo(() => data ? [
    { label: 'Total redemptions', value: (data.totalRedemptions || 0).toLocaleString('en-IN'), icon: TrendingUp },
    { label: 'Gross revenue',     value: `₹${Number(data.totalRevenueInr  || 0).toLocaleString('en-IN')}`, icon: IndianRupee },
    { label: 'Discount given',    value: `₹${Number(data.totalDiscountInr || 0).toLocaleString('en-IN')}`, icon: Percent },
  ] : [], [data]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground flex items-center gap-1.5"><s.icon className="h-3 w-3" />{s.label}</div>
            <div className="mt-1 font-serif text-2xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-3">Top influencers</div>
        <SimpleTable
          columns={[
            { key: 'rank', label: '#', render: (r, i) => <span className="text-muted-foreground">{i + 1}</span> },
            { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[12px] font-semibold">{r.code}</span> },
            { key: 'influencerName', label: 'Influencer', render: (r) => r.influencerName || <span className="text-muted-foreground italic">—</span> },
            { key: 'campaign',       label: 'Campaign',   render: (r) => r.campaign || <span className="text-muted-foreground">—</span> },
            { key: 'redemptions',    label: 'Uses' },
            { key: 'revenue',        label: 'Revenue', render: (r) => <span className="font-mono">₹{Number(r.revenue).toLocaleString('en-IN')}</span> },
            { key: 'discount',       label: 'Discount', render: (r) => <span className="font-mono text-muted-foreground">₹{Number(r.discount).toLocaleString('en-IN')}</span> },
          ]}
          rows={data?.perCoupon || []}
          empty="No redemptions yet."
        />
      </div>
    </div>
  );
}

function CouponEditor({ coupon, onClose, onSaved }) {
  const isEdit = Boolean(coupon?.id);
  const [form, setForm] = useState({
    code:               coupon.code || '',
    influencerName:     coupon.influencerName || '',
    campaign:           coupon.campaign || '',
    discountType:       coupon.discountType || 'percent',
    discountValue:      coupon.discountValue || 10,
    maxDiscountInr:     coupon.maxDiscountInr || 0,
    minPurchaseInr:     coupon.minPurchaseInr || 0,
    startsAt:           coupon.startsAt ? coupon.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    endsAt:             coupon.endsAt   ? coupon.endsAt.slice(0, 10)   : '',
    usageLimit:         coupon.usageLimit || 100,
    perCustomerLimit:   coupon.perCustomerLimit || 1,
    applicableTherapies: coupon.applicableTherapies || [],
    applicableBranches:  coupon.applicableBranches  || [],
    firstTimeOnly:      Boolean(coupon.firstTimeOnly),
    active:             coupon.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const { data: therapies = [] } = useQuery({ queryKey: ['therapies-lookup'], queryFn: fetchTherapies });
  const { data: branches  = [] } = useQuery({ queryKey: ['branches-lookup'],  queryFn: fetchBranches });

  const toggleArr = (key, val) => {
    const arr = form[key] || [];
    setForm({ ...form, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] });
  };

  const save = async () => {
    if (!form.code) return toast.error('Code required');
    if (!form.discountValue) return toast.error('Discount value required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt:   form.endsAt   ? new Date(form.endsAt).toISOString()   : null,
      };
      const url = isEdit ? `/api/admin/coupons/${coupon.id}` : '/api/admin/coupons';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'save_failed'); }
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch (e) { toast.error(String(e.message || 'Could not save')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open onClose={onClose} eyebrow={isEdit ? 'Edit' : 'New'} title={isEdit ? `Edit ${coupon.code}` : 'New coupon'} wide
      footer={<div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">{isEdit ? `Created ${new Date(coupon.createdAt).toLocaleDateString('en-IN')}` : ' '}</div>
        <div className="flex gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create coupon')}</PrimaryBtn></div>
      </div>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Code" required hint="Uppercase, no spaces. Customers type this exactly.">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '') })} placeholder="ANANYA10" disabled={isEdit} />
        </Field>
        <Field label="Influencer name">
          <Input value={form.influencerName} onChange={(e) => setForm({ ...form, influencerName: e.target.value })} placeholder="Ananya Reddy" />
        </Field>
        <Field label="Campaign" hint="Internal tag for grouping">
          <Input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} placeholder="Summer Push 2027" />
        </Field>
        <div /> {/* spacer */}

        <Field label="Discount type" required>
          <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="percent">Percent (%)</option>
            <option value="flat">Flat ₹</option>
          </Select>
        </Field>
        <Field label="Discount value" required hint={form.discountType === 'percent' ? 'e.g. 10 = 10%' : 'e.g. 500 = ₹500 off'}>
          <Input type="number" min={0} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
        </Field>

        {form.discountType === 'percent' && (
          <Field label="Max discount cap (₹)" hint="0 = no cap">
            <Input type="number" min={0} value={form.maxDiscountInr} onChange={(e) => setForm({ ...form, maxDiscountInr: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Minimum purchase (₹)" hint="0 = no minimum">
          <Input type="number" min={0} value={form.minPurchaseInr} onChange={(e) => setForm({ ...form, minPurchaseInr: Number(e.target.value) })} />
        </Field>

        <Field label="Valid from">
          <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        </Field>
        <Field label="Valid until" hint="Leave blank = never expires">
          <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        </Field>

        <Field label="Total usage limit" hint="0 = unlimited">
          <Input type="number" min={0} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} />
        </Field>
        <Field label="Per-customer limit" hint="How many times one customer can redeem">
          <Input type="number" min={0} value={form.perCustomerLimit} onChange={(e) => setForm({ ...form, perCustomerLimit: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Applicable therapies" hint="Leave blank = all therapies">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {therapies.map((th) => {
              const on = form.applicableTherapies.includes(th.slug);
              return (
                <button key={th.id || th.slug} type="button" onClick={() => toggleArr('applicableTherapies', th.slug)}
                  className={`h-8 px-2.5 rounded-lg border text-[12px] font-medium text-left transition-colors ${on ? 'border-brand bg-brand-soft/50' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                  {on ? '✓ ' : '+ '}{th.name}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {branches.length > 1 && (
        <div className="mt-4">
          <Field label="Applicable branches" hint="Leave blank = all branches">
            <div className="flex flex-wrap gap-1.5">
              {branches.map((b) => {
                const on = form.applicableBranches.includes(b.id);
                return (
                  <button key={b.id} type="button" onClick={() => toggleArr('applicableBranches', b.id)}
                    className={`h-8 px-3 rounded-full border text-[12px] font-medium transition-colors ${on ? 'border-brand bg-brand-soft/50' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                    {on ? '✓ ' : ''}{b.name}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer">
          <input type="checkbox" checked={form.firstTimeOnly} onChange={(e) => setForm({ ...form, firstTimeOnly: e.target.checked })} />
          <div><div className="text-[12.5px] font-medium">First-time customers only</div><div className="text-[11px] text-muted-foreground">Customers must have zero prior bookings.</div></div>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <div><div className="text-[12.5px] font-medium">Active</div><div className="text-[11px] text-muted-foreground">Turn off to pause without deleting.</div></div>
        </label>
      </div>
    </Drawer>
  );
}
