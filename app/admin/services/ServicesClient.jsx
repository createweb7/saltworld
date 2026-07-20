'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Lock, Layers, Info, X } from 'lucide-react';
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
async function fetchResources() {
  const res = await fetch('/api/admin/resources');
  if (!res.ok) return [];
  return res.json();
}
async function fetchBranches() {
  const res = await fetch('/api/admin/branches');
  if (!res.ok) return [];
  return res.json();
}

export default function ServicesClient({ user }) {
  const [tab, setTab] = useState('therapies');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['services', tab], queryFn: () => fetchList(tab) });

  const remove = async (row) => {
    if (row.isSystem) {
      toast.error('System therapies can\'t be deleted — deactivate instead');
      return;
    }
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/admin/services/${tab}/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'failed');
      }
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['services', tab] });
    } catch (e) { toast.error(e.message === 'system_therapy_cannot_be_deleted' ? 'System therapy — cannot delete' : 'Could not delete'); }
  };

  // Sort therapies: system first, alphabetical
  const rows = tab === 'therapies'
    ? [...data].sort((a, b) => (b.isSystem ? 1 : 0) - (a.isSystem ? 1 : 0) || (a.name || '').localeCompare(b.name || ''))
    : data;

  const columns = tab === 'therapies' ? [
    { key: 'name', label: 'Therapy', render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{r.name}</span>
        {r.isSystem && (
          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-brand/10 text-brand text-[10px] font-semibold uppercase tracking-[0.14em]"><Lock className="h-2.5 w-2.5" /> System</span>
        )}
      </div>
    ) },
    { key: 'slug', label: 'Slug', render: (r) => <code className="text-[11.5px] text-muted-foreground">/{r.slug}</code> },
    { key: 'durationMin', label: 'Duration', render: (r) => `${r.durationMin || 0} min` },
    { key: 'resources', label: 'Resources', render: (r) => (r.resourceIds?.length || 0) + '×' },
    { key: 'defaultPrice', label: 'Price', render: (r) => inr(r.defaultPrice) },
    { key: 'active', label: 'Status', render: (r) => (
      <div className="flex items-center gap-1.5">
        <StatusChip active={r.active} />
        {!r.onlineBookingEnabled && (
          <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400" title="Hidden from customer booking flow">Admin-only</span>
        )}
      </div>
    ) },
    { key: 'actions', label: '', render: (r) => <RowActions row={r} onEdit={() => setEditing(r)} onDelete={() => remove(r)} /> },
  ] : tab === 'journeys' ? [
    { key: 'name', label: 'Journey', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'therapyIds', label: 'Includes', render: (r) => `${(r.therapyIds || []).length} therapies` },
    { key: 'defaultPrice', label: 'Price', render: (r) => inr(r.defaultPrice) },
    { key: 'active', label: 'Status', render: (r) => <StatusChip active={r.active} /> },
    { key: 'actions', label: '', render: (r) => <RowActions row={r} onEdit={() => setEditing(r)} onDelete={() => remove(r)} /> },
  ] : [
    { key: 'name', label: 'Package', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'validityDays', label: 'Validity', render: (r) => `${r.validityDays || 0} days` },
    { key: 'defaultPrice', label: 'Price', render: (r) => inr(r.defaultPrice) },
    { key: 'active', label: 'Status', render: (r) => <StatusChip active={r.active} /> },
    { key: 'actions', label: '', render: (r) => <RowActions row={r} onEdit={() => setEditing(r)} onDelete={() => remove(r)} /> },
  ];

  return (
    <AdminShell user={user} title="Services" actions={
      <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New {tab === 'therapies' ? 'therapy' : tab.slice(0, -1)}</PrimaryBtn>
    }>
      <PageHeader eyebrow="Catalog" title="Services" subtitle="Configure the five master therapies (system) — duration, buffers, price, resources, per-branch availability. Landing pages and booking flow read from here." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={KINDS.map((k) => ({ ...k, count: tab === k.key ? data.length : undefined }))} active={tab} onChange={setTab} />
        </div>
        {tab === 'therapies' && (
          <div className="mb-4 rounded-xl border border-brand/30 bg-brand/5 p-3.5 flex gap-3 text-[12.5px]">
            <Info className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            <div className="text-muted-foreground leading-[1.55]">
              <span className="font-semibold text-foreground">Five system therapies</span> mirror the public landing pages at <code>/therapies/[slug]</code>. Their ops config (duration, buffers, price, resources) is edited here and consumed everywhere: website, booking flow, calendar, reception. Deletion is disabled — deactivate instead. New therapies are supported but not the primary use case.
            </div>
          </div>
        )}
        <SimpleTable columns={columns} rows={rows} isLoading={isLoading} empty={`No ${tab} yet. Create your first one to publish it on the website.`} />
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
    resourceIds:          initial?.resourceIds || [],
    defaultPrice: initial?.defaultPrice || 0,
    taxHsn: initial?.taxHsn || '999722',
    description: initial?.description || '',
    heroImage:   initial?.heroImage   || '',
    images:      initial?.images      || [],
    seoTitle:       initial?.seo?.title       || '',
    seoDescription: initial?.seo?.description || '',
    seoOgImage:     initial?.seo?.ogImage     || '',
    validityDays: initial?.validityDays || 30,
    active: initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('config');
  const { data: branches = [] } = useQuery({ queryKey: ['branches-lookup'], queryFn: fetchBranches });
  const { data: resources = [] } = useQuery({ queryKey: ['resources-lookup'], queryFn: fetchResources });

  const save = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/services/${kind}/${initial.id}` : `/api/admin/services/${kind}`;
      const numericFields = ['defaultPrice', 'durationMin', 'validityDays', 'cleaningBufferMin', 'preBufferMin', 'postBufferMin', 'maxCapacity'];
      const payload = { ...form };
      numericFields.forEach((k) => { payload[k] = Number(payload[k]); });
      payload.seo = {
        title: form.seoTitle || undefined,
        description: form.seoDescription || undefined,
        ogImage: form.seoOgImage || undefined,
      };
      delete payload.seoTitle; delete payload.seoDescription; delete payload.seoOgImage;
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

  const toggleId = (key, id) => {
    const set = new Set(form[key] || []);
    set.has(id) ? set.delete(id) : set.add(id);
    setForm({ ...form, [key]: Array.from(set) });
  };

  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url) setForm({ ...form, images: [...(form.images || []), url] });
  };
  const removeImage = (i) => setForm({ ...form, images: form.images.filter((_, idx) => idx !== i) });

  return (
    <Drawer open onClose={onClose} eyebrow={initial?.isSystem ? 'System therapy' : `${kind.charAt(0).toUpperCase()}${kind.slice(1, -1)}`}
      title={isEdit ? `Edit ${initial.name}` : `New ${kind.slice(0, -1)}`}
      wide
      footer={<div className="flex items-center justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      {kind === 'therapies' && (
        <div className="mb-4">
          <div className="flex gap-1 border-b border-border">
            {['config', 'resources', 'content', 'seo'].map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`h-8 px-3 text-[12.5px] font-medium capitalize ${tab === t ? 'text-foreground border-b-2 border-foreground -mb-px' : 'text-muted-foreground hover:text-foreground'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind !== 'therapies' && (
        <div className="space-y-3">
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Slug"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if blank" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)" required><Input type="number" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} /></Field>
            {kind === 'packages' && <Field label="Validity (days)"><Input type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} /></Field>}
          </div>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 mt-2 text-[13px]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" />
            Active
          </label>
        </div>
      )}

      {kind === 'therapies' && tab === 'config' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={initial?.isSystem}
                title={initial?.isSystem ? 'System therapies cannot be renamed — the slug is bound to the landing page.' : ''}/>
            </Field>
            <Field label="Slug" hint={initial?.isSystem ? 'Bound to the landing page' : 'Auto if blank'}>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={initial?.isSystem} />
            </Field>
          </div>

          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground pt-1">Scheduling</div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Duration (min)" required><Input type="number" min={1} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
            <Field label="Pre-buffer" hint="Setup"><Input type="number" min={0} value={form.preBufferMin} onChange={(e) => setForm({ ...form, preBufferMin: e.target.value })} /></Field>
            <Field label="Post-buffer" hint="Reset"><Input type="number" min={0} value={form.postBufferMin} onChange={(e) => setForm({ ...form, postBufferMin: e.target.value })} /></Field>
            <Field label="Cleaning" hint="After each"><Input type="number" min={0} value={form.cleaningBufferMin} onChange={(e) => setForm({ ...form, cleaningBufferMin: e.target.value })} /></Field>
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            Effective block per booking: <span className="font-mono font-semibold text-foreground">
              {(Number(form.preBufferMin)||0) + (Number(form.durationMin)||0) + (Number(form.postBufferMin)||0) + (Number(form.cleaningBufferMin)||0)} min
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Price (₹)" required><Input type="number" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} /></Field>
            <Field label="HSN" hint="999722 = wellness"><Input value={form.taxHsn} onChange={(e) => setForm({ ...form, taxHsn: e.target.value })} /></Field>
          </div>

          <div className="pt-1 space-y-2">
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={form.onlineBookingEnabled} onChange={(e) => setForm({ ...form, onlineBookingEnabled: e.target.checked })} className="mt-0.5 h-4 w-4" />
              <span><span className="font-medium">Online booking enabled</span><span className="block text-[11.5px] text-muted-foreground">Uncheck to hide from customer booking flow (still bookable by staff)</span></span>
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" />
              <span><span className="font-medium">Active</span><span className="ml-2 text-[11.5px] text-muted-foreground">Uncheck to hide entirely (website + booking)</span></span>
            </label>
          </div>

          {branches.length > 1 && (
            <div className="pt-1">
              <div className="text-[11.5px] font-medium mb-1.5">Branch availability</div>
              <div className="flex flex-wrap gap-1.5">
                {branches.map((b) => {
                  const checked = (form.branchIds || []).length === 0 || (form.branchIds || []).includes(b.id);
                  return (
                    <button key={b.id} type="button" onClick={() => toggleId('branchIds', b.id)}
                      className={`h-7 px-2.5 rounded-full border text-[11.5px] font-medium ${checked ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                      {b.name}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">Leave all unselected to be available at every branch.</div>
            </div>
          )}
        </div>
      )}

      {kind === 'therapies' && tab === 'resources' && (
        <div className="space-y-4">
          <div className="text-[13px] text-muted-foreground leading-[1.55]">
            Attach physical resources this therapy uses. Each resource is scoped to one branch. If two Float Tanks are attached at HSR, two bookings can run in parallel. Manage resources in <a href="/admin/settings" className="underline underline-offset-2">Settings → Resources</a>.
          </div>
          {branches.map((b) => {
            const branchResources = resources.filter((r) => r.branchId === b.id);
            if (branchResources.length === 0) return (
              <div key={b.id} className="rounded-lg border border-dashed border-border p-3">
                <div className="text-[12.5px] font-semibold mb-1">{b.name}</div>
                <div className="text-[11.5px] text-muted-foreground">No resources at this branch yet. Add one from Settings → Resources.</div>
              </div>
            );
            return (
              <div key={b.id} className="rounded-lg border border-border p-3">
                <div className="text-[12.5px] font-semibold mb-2">{b.name}</div>
                <div className="space-y-1.5">
                  {branchResources.map((r) => {
                    const linked = (form.resourceIds || []).includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 text-[13px]">
                        <input type="checkbox" checked={linked} onChange={() => toggleId('resourceIds', r.id)} className="h-4 w-4" />
                        <span className="font-medium">{r.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">· {r.type}</span>
                        {r.capacity > 1 && <span className="text-[11.5px] text-muted-foreground">· capacity {r.capacity}</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-[12px]">
            <span className="font-semibold">Parallel slots</span> = number of attached resources per branch. If HSR has 2 Float Tanks attached, 2 float bookings can happen at the same time.
          </div>
        </div>
      )}

      {kind === 'therapies' && tab === 'content' && (
        <div className="space-y-3">
          <Field label="Description" hint="Shown on the therapy landing page (hero body).">
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Hero image URL" hint="Large banner on the landing page.">
            <Input value={form.heroImage} onChange={(e) => setForm({ ...form, heroImage: e.target.value })} placeholder="https://…" />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11.5px] font-medium">Gallery images</div>
              <button type="button" onClick={addImage} className="h-7 px-2.5 rounded-md border border-border text-[11.5px] hover:bg-muted inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add image</button>
            </div>
            {(form.images || []).length === 0 && <div className="text-[11.5px] text-muted-foreground">No gallery images. The landing page will fall back to defaults.</div>}
            <div className="grid grid-cols-3 gap-2">
              {(form.images || []).map((url, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border bg-muted aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border border-border inline-flex items-center justify-center hover:bg-red-500/10 hover:text-red-600"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3 text-[11.5px] text-muted-foreground leading-[1.5]">
            <span className="font-medium text-foreground">Note:</span> Rich content (whoFor, benefits, science, FAQs) is dev-controlled in code. Ask engineering to update these sections. This is intentional to keep the science claims accurate and reviewed.
          </div>
        </div>
      )}

      {kind === 'therapies' && tab === 'seo' && (
        <div className="space-y-3">
          <Field label="SEO title" hint="Overrides the page <title>. Leave blank to use therapy name.">
            <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          </Field>
          <Field label="SEO description" hint="Search-result snippet, 150-160 chars.">
            <Textarea rows={2} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </Field>
          <Field label="Open Graph image URL" hint="Shown when the page is shared on WhatsApp / social.">
            <Input value={form.seoOgImage} onChange={(e) => setForm({ ...form, seoOgImage: e.target.value })} placeholder="https://…" />
          </Field>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1.5">Search preview</div>
            <div className="text-[15px] text-blue-600 leading-tight">{form.seoTitle || form.name}</div>
            <div className="text-[12px] text-emerald-700 mt-0.5">saltworld.in/therapies/{form.slug}</div>
            <div className="text-[12.5px] text-foreground/80 mt-1">{form.seoDescription || form.description || 'A short description will appear here.'}</div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function StatusChip({ active }) {
  return active
    ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Active</span>
    : <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-muted text-muted-foreground">Inactive</span>;
}

function RowActions({ row, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
      {!row.isSystem && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      )}
      {row.isSystem && (
        <span title="System therapy — cannot delete. Deactivate instead." className="h-7 w-7 rounded-md text-muted-foreground/40 inline-flex items-center justify-center"><Lock className="h-3.5 w-3.5" /></span>
      )}
    </div>
  );
}
