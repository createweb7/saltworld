'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Snowflake, RotateCcw, ArrowUp } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';

async function fetchPlans() {
  const res = await fetch('/api/admin/memberships');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchSubs() {
  const res = await fetch('/api/admin/memberships/subs');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function MembershipsClient({ user }) {
  const [tab, setTab] = useState('plans');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['memberships'], queryFn: fetchPlans });
  const subs  = useQuery({ queryKey: ['memberSubs'],  queryFn: fetchSubs });

  const removePlan = async (id) => {
    if (!confirm('Delete this plan?')) return;
    const res = await fetch(`/api/admin/memberships/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['memberships'] }); }
    else toast.error('Could not delete');
  };

  const subAction = async (id, action) => {
    const res = await fetch(`/api/admin/memberships/subs/${id}/${action}`, { method: 'POST' });
    if (res.ok) { toast.success(action); qc.invalidateQueries({ queryKey: ['memberSubs'] }); }
    else toast.error('Failed');
  };

  const planColumns = [
    { key: 'name', label: 'Plan', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'price', label: 'Price', render: (r) => `${inr(r.price)} / ${r.billingCycle || 'month'}` },
    { key: 'sessionsIncluded', label: 'Sessions' },
    { key: 'validityDays', label: 'Validity', render: (r) => `${r.validityDays || 30} days` },
    { key: 'active', label: 'Status', render: (r) => r.active ? <span className="text-emerald-600 text-[11.5px] font-medium">Active</span> : <span className="text-muted-foreground text-[11.5px]">Inactive</span> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); removePlan(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const subColumns = [
    { key: 'customerId', label: 'Customer', render: (r) => <span className="font-mono text-[12px]">{r.customerId?.slice(0, 8)}…</span> },
    { key: 'membershipId', label: 'Plan', render: (r) => <span className="font-mono text-[12px]">{r.membershipId?.slice(0, 8)}…</span> },
    { key: 'sessionsRemaining', label: 'Sessions left' },
    { key: 'endAt', label: 'Renews', render: (r) => new Date(r.endAt).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r) => <StatusChip s={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button title="Freeze" onClick={(e) => { e.stopPropagation(); subAction(r.id, r.status === 'frozen' ? 'unfreeze' : 'freeze'); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Snowflake className="h-3.5 w-3.5" /></button>
        <button title="Renew" onClick={(e) => { e.stopPropagation(); subAction(r.id, 'renew'); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><RotateCcw className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <AdminShell user={user} title="Memberships" actions={
      tab === 'plans' && <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New plan</PrimaryBtn>
    }>
      <PageHeader eyebrow="Sell" title="Memberships" subtitle="Manage plans and active member subscriptions." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={[
            { key: 'plans', label: 'Plans', count: plans.data?.length },
            { key: 'subs',  label: 'Members', count: subs.data?.length },
          ]} active={tab} onChange={setTab} />
        </div>
        {tab === 'plans' && <SimpleTable columns={planColumns} rows={plans.data || []} isLoading={plans.isLoading} empty="No plans yet. Create your first membership plan." />}
        {tab === 'subs'  && <SimpleTable columns={subColumns} rows={subs.data || []} isLoading={subs.isLoading} empty="No subscriptions yet." />}
      </AdminSection>

      {(newOpen || editing) && <PlanEditor initial={editing} onClose={() => { setEditing(null); setNewOpen(false); }} onSaved={() => { qc.invalidateQueries({ queryKey: ['memberships'] }); setEditing(null); setNewOpen(false); }} />}
    </AdminShell>
  );
}

function PlanEditor({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || '',
    price: initial?.price || 3499,
    billingCycle: initial?.billingCycle || 'monthly',
    sessionsIncluded: initial?.sessionsIncluded || 8,
    validityDays: initial?.validityDays || 30,
    perks: (initial?.perks || []).join('\n'),
    active: initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name, price: Number(form.price), billingCycle: form.billingCycle,
        sessionsIncluded: Number(form.sessionsIncluded), validityDays: Number(form.validityDays),
        perks: form.perks.split('\n').map((s) => s.trim()).filter(Boolean),
        active: form.active,
      };
      const url = isEdit ? `/api/admin/memberships/${initial.id}` : '/api/admin/memberships';
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open onClose={onClose} eyebrow="Membership" title={isEdit ? `Edit ${initial.name}` : 'New membership plan'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Plan name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wellness Monthly" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)" required><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Billing cycle">
            <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]">
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sessions included"><Input type="number" value={form.sessionsIncluded} onChange={(e) => setForm({ ...form, sessionsIncluded: e.target.value })} /></Field>
          <Field label="Validity (days)"><Input type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} /></Field>
        </div>
        <Field label="Perks (one per line)"><Textarea rows={4} value={form.perks} onChange={(e) => setForm({ ...form, perks: e.target.value })} placeholder="Priority booking&#10;20% off retail&#10;Free freeze during travel" /></Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Active
        </label>
      </div>
    </Drawer>
  );
}

function StatusChip({ s }) {
  const map = {
    active:   ['Active',   'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
    frozen:   ['Frozen',   'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
    expired:  ['Expired',  'bg-muted text-muted-foreground'],
    cancelled:['Cancelled','bg-muted text-muted-foreground'],
  };
  const [label, cls] = map[s] || ['—', 'bg-muted text-muted-foreground'];
  return <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${cls}`}>{label}</span>;
}
