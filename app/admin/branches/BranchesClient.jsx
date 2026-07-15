'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit3, Trash2, CheckCircle2, MapPin } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Drawer, Field, Input, Textarea, Select, PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';
import { formatDate } from '@/lib/date';

async function fetchBranches() {
  const res = await fetch('/api/admin/branches');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function BranchesClient({ user }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['branches'], queryFn: fetchBranches });
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const remove = async (id) => {
    if (!confirm('Delete this branch? All child records remain but become orphaned.')) return;
    const res = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Branch deleted'); qc.invalidateQueries({ queryKey: ['branches'] }); }
    else toast.error('Cannot delete the default branch');
  };
  const makeDefault = async (id) => {
    const res = await fetch(`/api/admin/branches/${id}/default`, { method: 'POST' });
    if (res.ok) { toast.success('Default branch updated'); qc.invalidateQueries({ queryKey: ['branches'] }); }
  };

  const columns = [
    { key: 'name', label: 'Branch', render: (r) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-brand/10 text-brand inline-flex items-center justify-center"><MapPin className="h-4 w-4" /></div>
        <div>
          <div className="font-medium text-[13px] flex items-center gap-2">{r.name}{r.isDefault && <span className="inline-flex items-center h-4 px-1.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-semibold uppercase tracking-widest gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> Default</span>}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{r.code}</div>
        </div>
      </div>
    ) },
    { key: 'address', label: 'Address', render: (r) => <span className="line-clamp-1 text-[12.5px] text-muted-foreground max-w-[380px] inline-block">{r.address}</span> },
    { key: 'phone',   label: 'Phone',   render: (r) => r.phone || '—' },
    { key: 'status',  label: 'Status',  render: (r) => <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${r.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{r.status}</span> },
    { key: 'createdAt', label: 'Created', render: (r) => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        {!r.isDefault && <button onClick={(e) => { e.stopPropagation(); makeDefault(r.id); }} className="h-7 px-2 rounded-md hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Set default</button>}
        <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        {!r.isDefault && <button onClick={(e) => { e.stopPropagation(); remove(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
    ) },
  ];

  return (
    <AdminShell user={user} title="Branches" actions={<PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New branch</PrimaryBtn>}>
      <PageHeader eyebrow="Company" title="Branches" subtitle="Manage locations, hours, holidays, and per-branch policies. Every booking, staff member and resource lives inside a branch." />
      <AdminSection>
        <SimpleTable columns={columns} rows={data} isLoading={isLoading} empty="No branches yet." />
      </AdminSection>
      {(newOpen || editing) && (
        <BranchEditor
          initial={editing}
          onClose={() => { setEditing(null); setNewOpen(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['branches'] }); setEditing(null); setNewOpen(false); }}
        />
      )}
    </AdminShell>
  );
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DEFAULT_HOURS = DAYS.reduce((acc, d) => ({ ...acc, [d]: { open: true, from: '06:00', to: '21:00' } }), {});

function BranchEditor({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    code:     initial?.code     || '',
    name:     initial?.name     || '',
    address:  initial?.address  || '',
    phone:    initial?.phone    || '',
    whatsapp: initial?.whatsapp || '',
    email:    initial?.email    || '',
    timezone: initial?.timezone || 'Asia/Kolkata',
    currency: initial?.currency || 'INR',
    status:   initial?.status   || 'active',
    hours:    initial?.hours    || DEFAULT_HOURS,
    holidays: initial?.holidays || [],
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/branches/${initial.id}` : '/api/admin/branches';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'failed');
      }
      toast.success(isEdit ? 'Branch updated' : 'Branch created');
      onSaved();
    } catch (e) {
      toast.error(e.message === 'code_taken' ? 'Branch code already exists' : 'Could not save');
    } finally { setSaving(false); }
  };

  const updateHours = (day, patch) => setForm((f) => ({ ...f, hours: { ...f.hours, [day]: { ...f.hours[day], ...patch } } }));

  return (
    <Drawer open onClose={onClose} eyebrow="Branch" title={isEdit ? `Edit “${initial.name}”` : 'New branch'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.name || !form.code}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required hint="3–8 chars, e.g. HSR"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={8} /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
        </div>
        <Field label="Branch name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="HSR Layout" /></Field>
        <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Timezone"><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
        </div>

        <div>
          <div className="text-[11.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">Business hours</div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {DAYS.map((d) => {
              const h = form.hours[d] || { open: true, from: '06:00', to: '21:00' };
              return (
                <div key={d} className="flex items-center gap-3 px-3 py-2">
                  <label className="flex items-center gap-2 min-w-[130px] capitalize text-[13px]">
                    <input type="checkbox" checked={h.open} onChange={(e) => updateHours(d, { open: e.target.checked })} />
                    {d}
                  </label>
                  <input type="time" disabled={!h.open} value={h.from} onChange={(e) => updateHours(d, { from: e.target.value })} className="h-8 px-2 rounded border border-border bg-background text-[12px] disabled:opacity-40" />
                  <span className="text-muted-foreground text-[12px]">to</span>
                  <input type="time" disabled={!h.open} value={h.to}   onChange={(e) => updateHours(d, { to:   e.target.value })} className="h-8 px-2 rounded border border-border bg-background text-[12px] disabled:opacity-40" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
