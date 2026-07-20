'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Sparkles, X, ChevronDown } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';

const MEMBERSHIP_TYPES = [
  { value: 'sessions',  label: 'Session Package',      hint: 'Fixed number of sessions valid for a period.' },
  { value: 'unlimited', label: 'Unlimited Membership', hint: 'Unlimited access within validity, optional per-day cap.' },
  { value: 'wallet',    label: 'Wallet Membership',    hint: 'Prepaid \u20b9 balance deducted per booking.' },
  { value: 'corporate', label: 'Corporate (Future)',   hint: 'Company-owned, employees redeem. UI shown for planning.' },
  { value: 'family',    label: 'Family (Future)',      hint: 'One plan shared across linked customers.' },
  { value: 'trial',     label: 'Trial (Future)',       hint: 'Time-limited or session-limited free trial.' },
];

const BILLING_CYCLES = [
  { value: 'one_time',   label: 'One Time' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'halfyearly', label: 'Half-Yearly' },
  { value: 'yearly',     label: 'Yearly' },
];

const BENEFIT_CATALOG = [
  { code: 'priority_booking',      label: 'Priority booking' },
  { code: 'complimentary_beverage',label: 'Complimentary beverage' },
  { code: 'retail_discount',       label: 'Retail discount' },
  { code: 'guest_passes',          label: 'Guest passes' },
  { code: 'birthday_session',      label: 'Free birthday session' },
  { code: 'member_pricing',        label: 'Member pricing on add-ons' },
  { code: 'exclusive_time_slots',  label: 'Exclusive time slots' },
  { code: 'consultation',          label: 'Free consultations' },
  { code: 'gift_card_discount',    label: 'Gift card discount' },
];

const REFUND_POLICIES = [
  { value: 'no_refund',    label: 'Non-refundable once activated' },
  { value: 'prorated',     label: 'Pro-rated refund on unused sessions' },
  { value: 'full_before',  label: 'Full refund before first use' },
  { value: 'custom',       label: 'Custom (documented per plan)' },
];

async function fetchPlans() {
  const res = await fetch('/api/admin/memberships'); if (!res.ok) throw new Error('failed'); return res.json();
}
async function fetchSubs() {
  const res = await fetch('/api/admin/memberships/subs'); if (!res.ok) throw new Error('failed'); return res.json();
}
async function fetchBranches() {
  const res = await fetch('/api/admin/branches'); if (!res.ok) return []; return res.json();
}
async function fetchTherapies() {
  const res = await fetch('/api/admin/services/therapies'); if (!res.ok) return []; return res.json();
}

export default function MembershipsClient({ user }) {
  const [tab, setTab] = useState('plans');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const { data: plans = [], isLoading: loadingPlans } = useQuery({ queryKey: ['admin-plans'], queryFn: fetchPlans });
  const { data: subs = [],  isLoading: loadingSubs  } = useQuery({ queryKey: ['admin-subs'],  queryFn: fetchSubs, enabled: tab === 'subs' });

  const remove = async (row) => {
    if (!confirm('Delete this plan? Existing customer subscriptions will keep their planSnapshot.')) return;
    try {
      const res = await fetch(`/api/admin/memberships/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
    } catch { toast.error('Could not delete'); }
  };

  const planColumns = [
    { key: 'name', label: 'Plan', render: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">/{r.slug}</div>
      </div>
    ) },
    { key: 'type', label: 'Type', render: (r) => <TypeChip type={r.type} /> },
    { key: 'price', label: 'Price', render: (r) => (
      <div>
        <div className="font-mono font-semibold">{inr(r.price)}</div>
        <div className="text-[11px] text-muted-foreground">+{r.gstPercent || 18}% GST</div>
      </div>
    )},
    { key: 'validityDays', label: 'Validity', render: (r) => `${r.validityDays}d` },
    { key: 'sessions', label: 'Includes', render: (r) => r.type === 'sessions' ? `${r.sessionsIncluded} sess.` : r.type === 'unlimited' ? (r.dailyUsageLimit ? `${r.dailyUsageLimit}/day` : 'unlimited') : r.type },
    { key: 'coverage', label: 'Coverage', render: (r) => (
      <div className="text-[12px]">{r.applicableTherapies?.length > 0 ? `${r.applicableTherapies.length} therapies` : 'All therapies'}</div>
    )},
    { key: 'active', label: 'Status', render: (r) => <StatusChip active={r.active} /> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const subColumns = [
    { key: 'planName', label: 'Plan', render: (r) => <div className="font-medium">{r.planName || r.planSnapshot?.name}</div> },
    { key: 'customerId', label: 'Customer', render: (r) => <span className="font-mono text-[11px] text-muted-foreground">{(r.customerId || '').slice(0, 8)}\u2026</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusChip active={r.status === 'active'} label={r.status} /> },
    { key: 'validity', label: 'Validity', render: (r) => (
      <div className="text-[12px]">
        <div>Ends {new Date(r.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
        <div className="text-muted-foreground">Started {new Date(r.startAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
      </div>
    )},
    { key: 'usage', label: 'Usage', render: (r) => r.planSnapshot?.type === 'sessions' ? `${r.sessionsUsed || 0}/${r.sessionsIncluded || 0}` : '—' },
    { key: 'payment', label: 'Payment', render: (r) => <span className="capitalize text-[12px]">{r.payment?.method || '—'}</span> },
  ];

  return (
    <AdminShell user={user} title="Memberships" actions={
      tab === 'plans' ? <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New plan</PrimaryBtn> : null
    }>
      <PageHeader eyebrow="Commerce" title="Memberships" subtitle="Plan catalog + active subscriptions. Plans are the products; subscriptions are their purchased instances." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={[
            { key: 'plans', label: 'Plans', count: plans.length },
            { key: 'subs',  label: 'Subscriptions', count: subs.length || undefined },
          ]} active={tab} onChange={setTab} />
        </div>
        {tab === 'plans' && (
          <SimpleTable columns={planColumns} rows={plans} isLoading={loadingPlans} empty="No plans yet. Create your first plan to start selling memberships." />
        )}
        {tab === 'subs' && (
          <SimpleTable columns={subColumns} rows={subs} isLoading={loadingSubs} empty="No customer subscriptions yet." />
        )}
      </AdminSection>

      {(newOpen || editing) && (
        <PlanEditor initial={editing} onClose={() => { setNewOpen(false); setEditing(null); }} onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-plans'] });
          setNewOpen(false); setEditing(null);
        }} />
      )}
    </AdminShell>
  );
}

/* ================================================================ */
/*  Rich Plan Editor — dynamic fields per membership type           */
/* ================================================================ */

function PlanEditor({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    code: initial?.code || '',
    description: initial?.description || '',
    type: initial?.type || 'sessions',
    price:      initial?.price      || 0,
    gstPercent: initial?.gstPercent || 18,
    billingCycle: initial?.billingCycle || 'one_time',
    validityDays:     initial?.validityDays     || 30,
    sessionsIncluded: initial?.sessionsIncluded || 0,
    walletCredit:     initial?.walletCredit     || 0,
    dailyUsageLimit:   initial?.dailyUsageLimit   || 0,
    weeklyUsageLimit:  initial?.weeklyUsageLimit  || 0,
    monthlyUsageLimit: initial?.monthlyUsageLimit || 0,
    cooldownMin:       initial?.cooldownMin       || 0,
    advanceBookingDays: initial?.advanceBookingDays || 30,
    applicableTherapies: initial?.applicableTherapies || [],
    applicableBranches:  initial?.applicableBranches  || [],
    benefits:            initial?.benefits            || [],
    freezeAllowed:   initial?.freezeAllowed !== false,
    pauseAllowed:    initial?.pauseAllowed  !== false,
    transferAllowed: Boolean(initial?.transferAllowed),
    giftable:        initial?.giftable !== false,
    autoRenew:       Boolean(initial?.autoRenew),
    refundPolicy: initial?.refundPolicy || 'no_refund',
    startsOnFirstVisit: Boolean(initial?.startsOnFirstVisit),
    active: initial?.active !== false,
    order: initial?.order || 100,
    heroImage: initial?.heroImage || '',
  });
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const { data: branches  = [] } = useQuery({ queryKey: ['branches-lookup'],  queryFn: fetchBranches });
  const { data: therapies = [] } = useQuery({ queryKey: ['therapies-lookup'], queryFn: fetchTherapies });

  const t = form.type;
  const showSessions   = t === 'sessions';
  const showUnlimited  = t === 'unlimited';
  const showWallet     = t === 'wallet';
  const showDailyLimit = t === 'unlimited' || t === 'sessions';

  const toggleArr = (key, val) => {
    const set = new Set(form[key] || []);
    set.has(val) ? set.delete(val) : set.add(val);
    setForm({ ...form, [key]: Array.from(set) });
  };
  const toggleAllTherapies = () => setForm({ ...form, applicableTherapies: [] });
  const isAllTherapies = form.applicableTherapies.length === 0;

  const addBenefit = (code, label) => {
    if (form.benefits.some((b) => b.code === code)) return;
    setForm({ ...form, benefits: [...form.benefits, { code, label, config: {} }] });
  };
  const removeBenefit = (code) => setForm({ ...form, benefits: form.benefits.filter((b) => b.code !== code) });
  const updateBenefitConfig = (code, key, value) => setForm({
    ...form,
    benefits: form.benefits.map((b) => b.code === code ? { ...b, config: { ...(b.config||{}), [key]: value } } : b),
  });

  const save = async () => {
    setSaving(true);
    try {
      const numericFields = ['price', 'gstPercent', 'validityDays', 'sessionsIncluded', 'walletCredit', 'dailyUsageLimit', 'weeklyUsageLimit', 'monthlyUsageLimit', 'cooldownMin', 'advanceBookingDays', 'order'];
      const payload = { ...form };
      numericFields.forEach((k) => { payload[k] = Number(payload[k]) || 0; });
      const url = isEdit ? `/api/admin/memberships/${initial.id}` : '/api/admin/memberships';
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success(isEdit ? 'Plan updated' : 'Plan created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };

  const tabs = ['general', 'billing', 'coverage', 'usage', 'benefits', 'policy'];

  return (
    <Drawer open onClose={onClose} eyebrow={form.type ? MEMBERSHIP_TYPES.find((x) => x.value === form.type)?.label : 'Membership'}
      title={isEdit ? `Edit ${initial.name}` : 'New membership plan'} wide
      footer={<div className="flex items-center justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</PrimaryBtn></div>}
    >
      <div className="flex gap-1 border-b border-border mb-5">
        {tabs.map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`h-8 px-3 text-[12.5px] font-medium capitalize ${tab === k ? 'text-foreground border-b-2 border-foreground -mb-px' : 'text-muted-foreground hover:text-foreground'}`}>{k}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Salt Cave · 6 Months" /></Field>
            <Field label="Slug" hint="Public URL: /memberships/[slug]"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto if blank" /></Field>
          </div>
          <Field label="Internal code / SKU" hint="Optional. Shown on invoices and reports.">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SALT-6M-STD" />
          </Field>
          <Field label="Description" hint="Shown on the public catalog card and detail page.">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Six months of unlimited daily halotherapy — our most popular plan." />
          </Field>
          <Field label="Membership type" required hint="Determines how the booking engine consumes this plan.">
            <div className="grid md:grid-cols-2 gap-2">
              {MEMBERSHIP_TYPES.map((mt) => (
                <label key={mt.value}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${form.type === mt.value ? 'border-brand bg-brand-soft/40' : 'border-border hover:border-foreground/30'}`}>
                  <input type="radio" name="type" value={mt.value} checked={form.type === mt.value} onChange={() => setForm({ ...form, type: mt.value })} className="sr-only" />
                  <div className="flex items-center gap-2">
                    <div className={`h-3.5 w-3.5 rounded-full border-2 ${form.type === mt.value ? 'border-brand bg-brand' : 'border-border'}`} />
                    <div className="text-[13px] font-medium">{mt.label}</div>
                  </div>
                  <div className="mt-1 text-[11.5px] text-muted-foreground leading-[1.45] ml-5.5">{mt.hint}</div>
                </label>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-[13px] pt-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" />
            <span><span className="font-medium">Active</span> <span className="text-[11.5px] text-muted-foreground ml-2">Uncheck to hide from public catalog</span></span>
          </label>
        </div>
      )}

      {tab === 'billing' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)" required><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="GST %" hint="Applied on top of price"><Input type="number" min={0} value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} /></Field>
          </div>
          <Field label="Billing cycle">
            <Select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
              {BILLING_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Auto-renewal" hint="Requires Razorpay recurring subscription (deferred).">
            <label className="flex items-center gap-2 text-[13px] mt-1">
              <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} className="h-4 w-4" disabled />
              <span className="text-muted-foreground">Charge automatically at end of billing cycle <span className="ml-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] px-1.5 rounded-full bg-muted text-muted-foreground">soon</span></span>
            </label>
          </Field>
          <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-[12px] leading-[1.55]">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-1">Preview</div>
            <div>Customer sees <span className="font-mono font-semibold">{inr(form.price)}</span> · Includes {form.gstPercent}% GST</div>
            {form.billingCycle !== 'one_time' && <div className="text-muted-foreground mt-1">Renews {form.billingCycle}</div>}
          </div>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="space-y-4">
          <Field label="Applicable therapies" hint="Which therapies can this plan redeem against? Leave blank = all therapies.">
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={toggleAllTherapies}
                className={`h-7 px-3 rounded-full text-[11.5px] font-medium border transition-colors ${isAllTherapies ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                All therapies
              </button>
              <div className="text-[11.5px] text-muted-foreground">or pick specific ones</div>
            </div>
            {!isAllTherapies && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {therapies.map((th) => {
                  const on = form.applicableTherapies.includes(th.slug);
                  return (
                    <button key={th.id} type="button" onClick={() => toggleArr('applicableTherapies', th.slug)}
                      className={`h-8 px-2.5 rounded-lg border text-[12px] font-medium text-left transition-colors ${on ? 'border-brand bg-brand-soft/50' : 'border-border hover:border-foreground/30'}`}>
                      {on && '✓ '}{th.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {branches.length > 1 && (
            <Field label="Applicable branches" hint="Leave blank = all branches">
              <div className="flex flex-wrap gap-1.5">
                {branches.map((b) => {
                  const on = form.applicableBranches.includes(b.id);
                  return (
                    <button key={b.id} type="button" onClick={() => toggleArr('applicableBranches', b.id)}
                      className={`h-7 px-2.5 rounded-full border text-[11.5px] font-medium transition-colors ${on ? 'border-brand bg-brand-soft/50' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      {on && '✓ '}{b.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </div>
      )}

      {tab === 'usage' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Validity (days)" required><Input type="number" min={1} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} /></Field>
            <div className="pt-6">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={form.startsOnFirstVisit} onChange={(e) => setForm({ ...form, startsOnFirstVisit: e.target.checked })} className="h-4 w-4" />
                <span>Validity starts on <span className="font-medium">first visit</span> (else purchase date)</span>
              </label>
            </div>
          </div>

          {showSessions && (
            <Field label="Sessions included" required hint="Total sessions the customer gets to consume.">
              <Input type="number" min={0} value={form.sessionsIncluded} onChange={(e) => setForm({ ...form, sessionsIncluded: e.target.value })} placeholder="e.g. 4 / 8 / 12" />
            </Field>
          )}

          {showWallet && (
            <Field label="Wallet credit (₹)" required hint="Prepaid balance available at booking.">
              <Input type="number" min={0} value={form.walletCredit} onChange={(e) => setForm({ ...form, walletCredit: e.target.value })} />
            </Field>
          )}

          {showUnlimited && (
            <div className="rounded-lg border border-dashed border-brand/40 bg-brand-soft/30 p-3 text-[12px] leading-[1.55]">
              <span className="font-medium">Unlimited access.</span> Set optional per-day / week / month caps below to prevent overuse.
            </div>
          )}

          {showDailyLimit && (
            <>
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground pt-2">Usage caps (0 = unlimited)</div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Daily limit"><Input type="number" min={0} value={form.dailyUsageLimit}   onChange={(e) => setForm({ ...form, dailyUsageLimit: e.target.value })} /></Field>
                <Field label="Weekly limit"><Input type="number" min={0} value={form.weeklyUsageLimit}  onChange={(e) => setForm({ ...form, weeklyUsageLimit: e.target.value })} /></Field>
                <Field label="Monthly limit"><Input type="number" min={0} value={form.monthlyUsageLimit} onChange={(e) => setForm({ ...form, monthlyUsageLimit: e.target.value })} /></Field>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Cooldown between visits (min)" hint="0 = no cooldown"><Input type="number" min={0} value={form.cooldownMin} onChange={(e) => setForm({ ...form, cooldownMin: e.target.value })} /></Field>
            <Field label="Advance booking window (days)" hint="How far ahead can members book"><Input type="number" min={1} value={form.advanceBookingDays} onChange={(e) => setForm({ ...form, advanceBookingDays: e.target.value })} /></Field>
          </div>
        </div>
      )}

      {tab === 'benefits' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground leading-[1.55]">
            Attach configurable benefits. Some benefits (e.g. guest passes) support a quantity — set it after adding.
          </div>
          <div>
            <div className="text-[11.5px] font-medium mb-2">Available benefits</div>
            <div className="flex flex-wrap gap-1.5">
              {BENEFIT_CATALOG.map((b) => {
                const on = form.benefits.some((x) => x.code === b.code);
                return (
                  <button key={b.code} type="button"
                    onClick={() => on ? removeBenefit(b.code) : addBenefit(b.code, b.label)}
                    className={`h-8 px-3 rounded-full border text-[12px] font-medium transition-colors ${on ? 'border-brand bg-brand-soft/50' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                    {on ? '✓ ' : '+ '}{b.label}
                  </button>
                );
              })}
            </div>
          </div>
          {form.benefits.length > 0 && (
            <div>
              <div className="text-[11.5px] font-medium mb-2">Selected · {form.benefits.length}</div>
              <div className="space-y-2">
                {form.benefits.map((b) => (
                  <div key={b.code} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                    <Sparkles className="h-3.5 w-3.5 text-brand shrink-0" />
                    <div className="flex-1 text-[13px] font-medium">{b.label}</div>
                    {(b.code === 'guest_passes' || b.code === 'retail_discount' || b.code === 'gift_card_discount' || b.code === 'member_pricing') && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">{b.code === 'guest_passes' ? 'Qty' : '% off'}</span>
                        <input type="number" min={0} value={b.config?.value || 0} onChange={(e) => updateBenefitConfig(b.code, 'value', Number(e.target.value))}
                          className="h-7 w-16 rounded-md border border-border bg-background px-2 text-[12px] font-mono" />
                      </div>
                    )}
                    <button type="button" onClick={() => removeBenefit(b.code)} className="h-6 w-6 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'policy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="rounded-lg border border-border p-3 flex items-start gap-2 cursor-pointer hover:border-foreground/30">
              <input type="checkbox" checked={form.freezeAllowed}   onChange={(e) => setForm({ ...form, freezeAllowed: e.target.checked })} className="mt-1 h-4 w-4" />
              <span><span className="block text-[13px] font-medium">Freeze allowed</span><span className="text-[11.5px] text-muted-foreground">Members can pause; validity extends by frozen days.</span></span>
            </label>
            <label className="rounded-lg border border-border p-3 flex items-start gap-2 cursor-pointer hover:border-foreground/30">
              <input type="checkbox" checked={form.pauseAllowed}    onChange={(e) => setForm({ ...form, pauseAllowed: e.target.checked })} className="mt-1 h-4 w-4" />
              <span><span className="block text-[13px] font-medium">Pause allowed</span><span className="text-[11.5px] text-muted-foreground">Admin can pause and resume any time.</span></span>
            </label>
            <label className="rounded-lg border border-border p-3 flex items-start gap-2 cursor-pointer hover:border-foreground/30">
              <input type="checkbox" checked={form.transferAllowed} onChange={(e) => setForm({ ...form, transferAllowed: e.target.checked })} className="mt-1 h-4 w-4" />
              <span><span className="block text-[13px] font-medium">Transferable</span><span className="text-[11.5px] text-muted-foreground">Membership can be reassigned to another customer.</span></span>
            </label>
            <label className="rounded-lg border border-border p-3 flex items-start gap-2 cursor-pointer hover:border-foreground/30">
              <input type="checkbox" checked={form.giftable}        onChange={(e) => setForm({ ...form, giftable: e.target.checked })} className="mt-1 h-4 w-4" />
              <span><span className="block text-[13px] font-medium">Giftable</span><span className="text-[11.5px] text-muted-foreground">Sold as a gift card / voucher.</span></span>
            </label>
          </div>
          <Field label="Refund policy">
            <Select value={form.refundPolicy} onChange={(e) => setForm({ ...form, refundPolicy: e.target.value })}>
              {REFUND_POLICIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Display order" hint="Lower numbers appear first on the public catalog.">
            <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
          </Field>
        </div>
      )}
    </Drawer>
  );
}

function TypeChip({ type }) {
  const mt = MEMBERSHIP_TYPES.find((x) => x.value === type);
  const label = mt?.label || type;
  const colors = {
    sessions:  'bg-brand/10 text-brand',
    unlimited: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    wallet:    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    corporate: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    family:    'bg-pink-500/10 text-pink-700 dark:text-pink-400',
    trial:     'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  };
  return <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] ${colors[type] || 'bg-muted text-muted-foreground'}`}>{label}</span>;
}

function StatusChip({ active, label }) {
  return active
    ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{label || 'Active'}</span>
    : <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-muted text-muted-foreground">{label || 'Inactive'}</span>;
}
