'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';

const KINDS = [
  { key: 'therapies', label: 'Therapies' },
  { key: 'journeys',  label: 'Wellness journeys' },
  { key: 'packages',  label: 'Packages' },
];

async function fetchList(kind) {
  const res = await fetch(`/api/admin/services/${kind}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function ServicesClient({ user }) {
  const [tab, setTab] = useState('therapies');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['services', tab], queryFn: () => fetchList(tab) });

  const remove = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/admin/services/${tab}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['services', tab] });
    } catch { toast.error('Could not delete'); }
  };

  const columns = tab === 'therapies' ? [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'durationMin', label: 'Duration', render: (r) => `${r.durationMin || 0} min` },
    { key: 'defaultPrice', label: 'Price', render: (r) => inr(r.defaultPrice) },
    { key: 'active', label: 'Status', render: (r) => <StatusChip active={r.active} /> },
    { key: 'actions', label: '', render: (r) => <RowActions onEdit={() => setEditing(r)} onDelete={() => remove(r.id)} /> },
  ] : tab === 'journeys' ? [
    { key: 'name', label: 'Journey', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'therapyIds', label: 'Includes', render: (r) => `${(r.therapyIds || []).length} therapies` },
    { key: 'defaultPrice', label: 'Price', render: (r) => inr(r.defaultPrice) },
    { key: 'active', label: 'Status', render: (r) => <StatusChip active={r.active} /> },
    { key: 'actions', label: '', render: (r) => <RowActions onEdit={() => setEditing(r)} onDelete={() => remove(r.id)} /> },
  ] : [
    { key: 'name', label: 'Package', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'validityDays', label: 'Validity', render: (r) => `${r.validityDays || 0} days` },
    { key: 'defaultPrice', label: 'Price', render: (r) => inr(r.defaultPrice) },
    { key: 'active', label: 'Status', render: (r) => <StatusChip active={r.active} /> },
    { key: 'actions', label: '', render: (r) => <RowActions onEdit={() => setEditing(r)} onDelete={() => remove(r.id)} /> },
  ];

  return (
    <AdminShell user={user} title="Services" actions={
      <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New {tab === 'therapies' ? 'therapy' : tab.slice(0, -1)}</PrimaryBtn>
    }>
      <PageHeader eyebrow="Catalog" title="Services" subtitle="Therapies, wellness journeys and packages. Prices exclude GST." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={KINDS.map((k) => ({ ...k, count: tab === k.key ? data.length : undefined }))} active={tab} onChange={setTab} />
        </div>
        <SimpleTable columns={columns} rows={data} isLoading={isLoading} empty={`No ${tab} yet. Create your first one to publish it on the website.`} />
      </AdminSection>

      {(newOpen || editing) && (
        <ServiceEditor kind={tab} initial={editing} onClose={() => { setEditing(null); setNewOpen(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['services', tab] }); setEditing(null); setNewOpen(false); }} />
      )}
    </AdminShell>
  );
}

function ServiceEditor({ kind, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    durationMin:          initial?.durationMin       || 60,
    preBufferMin:         initial?.preBufferMin      || 0,
    postBufferMin:        initial?.postBufferMin     || 0,
    cleaningBufferMin:    initial?.cleaningBufferMin || 15,
    maxCapacity:          initial?.maxCapacity       || 1,
    onlineBookingEnabled: initial?.onlineBookingEnabled !== false,
    branchIds:            initial?.branchIds || [],
    defaultPrice: initial?.defaultPrice || 0,
    taxHsn: initial?.taxHsn || '999722',
    description: initial?.description || '',
    validityDays: initial?.validityDays || 30,
    active: initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const { data: branches = [] } = useQuery({ queryKey: ['branches-lookup'], queryFn: async () => (await fetch('/api/admin/branches')).json() });

  const save = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/services/${kind}/${initial.id}` : `/api/admin/services/${kind}`;
      const numericFields = ['defaultPrice', 'durationMin', 'validityDays', 'cleaningBufferMin', 'preBufferMin', 'postBufferMin', 'maxCapacity'];
      const payload = { ...form };
      numericFields.forEach((k) => { payload[k] = Number(payload[k]); });
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };

  const toggleBranch = (id) => {
    const set = new Set(form.branchIds);
    set.has(id) ? set.delete(id) : set.add(id);
    setForm({ ...form, branchIds: Array.from(set) });
  };

  return (
    <Drawer open onClose={onClose} eyebrow={`${kind.charAt(0).toUpperCase()}${kind.slice(1, -1)}`} title={isEdit ? `Edit ${initial.name}` : `New ${kind.slice(0, -1)}`}
      footer={<div className="flex items-center justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Slug" hint="Auto-generated from name if left blank"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="e.g. float-therapy" /></Field>
        {kind === 'therapies' && (
          <>
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground pt-2">Scheduling</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Duration (min)" required><Input type="number" min={5} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
              <Field label="Pre-buffer" hint="Setup min"><Input type="number" min={0} value={form.preBufferMin} onChange={(e) => setForm({ ...form, preBufferMin: e.target.value })} /></Field>
              <Field label="Post-buffer" hint="Reset min"><Input type="number" min={0} value={form.postBufferMin} onChange={(e) => setForm({ ...form, postBufferMin: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cleaning (min)"><Input type="number" min={0} value={form.cleaningBufferMin} onChange={(e) => setForm({ ...form, cleaningBufferMin: e.target.value })} /></Field>
              <Field label="Max capacity" hint="Simultaneous guests"><Input type="number" min={1} value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} /></Field>
            </div>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={form.onlineBookingEnabled} onChange={(e) => setForm({ ...form, onlineBookingEnabled: e.target.checked })} className="mt-0.5 h-4 w-4" />
              <span><span className="font-medium">Online booking enabled</span><span className="block text-[11.5px] text-muted-foreground">Uncheck to hide from the public booking flow (still available to admin)</span></span>
            </label>
            {branches.length > 1 && (
              <div>
                <div className="text-[11.5px] font-medium mb-1.5">Branch availability</div>
                <div className="flex flex-wrap gap-1.5">
                  {branches.map((b) => {
                    const checked = form.branchIds.length === 0 || form.branchIds.includes(b.id);
                    return (
                      <button key={b.id} type="button" onClick={() => toggleBranch(b.id)}
                        className={`h-7 px-2.5 rounded-full border text-[11.5px] font-medium ${checked ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                        {b.name}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1.5">Leave all unselected to make available at every branch.</div>
              </div>
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)" required><Input type="number" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} /></Field>
          <Field label="HSN" hint="999722 for wellness services"><Input value={form.taxHsn} onChange={(e) => setForm({ ...form, taxHsn: e.target.value })} /></Field>
        </div>
        {kind === 'packages' && (
          <Field label="Validity (days)"><Input type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} /></Field>
        )}
        <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Public-facing description shown on the website." /></Field>
        <label className="flex items-center gap-2 mt-2 text-[13px]">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" />
          Active (visible on the website)
        </label>
      </div>
    </Drawer>
  );
}

function StatusChip({ active }) {
  return active
    ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Active</span>
    : <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-muted text-muted-foreground">Inactive</span>;
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}
