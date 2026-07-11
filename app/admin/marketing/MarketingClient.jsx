'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Star, Megaphone } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';

const KINDS = [
  { key: 'announcements', label: 'Announcements' },
  { key: 'campaigns',     label: 'Campaigns'     },
  { key: 'reviews',       label: 'Reviews'       },
  { key: 'testimonials',  label: 'Testimonials'  },
];

async function fetchList(kind) {
  const res = await fetch(`/api/admin/marketing/${kind}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function MarketingClient({ user }) {
  const [tab, setTab] = useState('announcements');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['marketing', tab], queryFn: () => fetchList(tab) });

  const remove = async (id) => {
    if (!confirm('Delete this item?')) return;
    const res = await fetch(`/api/admin/marketing/${tab}/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['marketing', tab] }); }
  };

  const columns = tab === 'announcements' ? [
    { key: 'body',   label: 'Message', render: (r) => <span className="text-[13px]">{r.body || r.text || '—'}</span> },
    { key: 'kind',   label: 'Placement', render: (r) => <span className="capitalize text-[12px]">{r.kind || 'bar'}</span> },
    { key: 'active', label: 'Status',   render: (r) => r.active ? <Chip cls="emerald">Live</Chip> : <Chip>Paused</Chip> },
    { key: 'actions',label: '', render: rowActions(setEditing, remove) },
  ] : tab === 'campaigns' ? [
    { key: 'name',       label: 'Name',    render: (r) => <span className="font-medium">{r.name || 'Untitled'}</span> },
    { key: 'templateId', label: 'Template' },
    { key: 'status',     label: 'Status',  render: (r) => <Chip>{r.status || 'draft'}</Chip> },
    { key: 'stats',      label: 'Stats',   render: (r) => <span className="text-[11.5px] text-muted-foreground">{r.stats?.sent || 0} sent</span> },
    { key: 'actions',    label: '', render: rowActions(setEditing, remove) },
  ] : tab === 'reviews' ? [
    { key: 'rating', label: 'Rating', render: (r) => <span className="inline-flex items-center gap-0.5">{Array.from({ length: r.rating || 5 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current text-amber-500" />)}</span> },
    { key: 'body',   label: 'Quote',  render: (r) => <span className="text-[13px] line-clamp-2">{r.body}</span> },
    { key: 'author', label: 'Author', render: (r) => <span className="text-[12.5px]">{r.author}</span> },
    { key: 'source', label: 'Source', render: (r) => <span className="capitalize text-[11.5px] text-muted-foreground">{r.source || 'website'}</span> },
    { key: 'actions',label: '', render: rowActions(setEditing, remove) },
  ] : [ // testimonials
    { key: 'body',   label: 'Quote',  render: (r) => <span className="text-[13px] line-clamp-2">{r.body}</span> },
    { key: 'author', label: 'Author', render: (r) => <span className="text-[12.5px]">{r.author}</span> },
    { key: 'active', label: 'Status', render: (r) => r.active ? <Chip cls="emerald">Featured</Chip> : <Chip>Hidden</Chip> },
    { key: 'actions',label: '', render: rowActions(setEditing, remove) },
  ];

  return (
    <AdminShell user={user} title="Marketing" actions={
      <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New {tab.slice(0, -1)}</PrimaryBtn>
    }>
      <PageHeader eyebrow="Growth" title="Marketing" subtitle="Announcements, campaigns, Google reviews and curated testimonials." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={KINDS.map((k) => ({ ...k, count: tab === k.key ? data.length : undefined }))} active={tab} onChange={setTab} />
        </div>
        <SimpleTable columns={columns} rows={data} isLoading={isLoading} empty={`No ${tab} yet.`} />
      </AdminSection>

      {(newOpen || editing) && (
        <MarketingEditor kind={tab} initial={editing} onClose={() => { setEditing(null); setNewOpen(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['marketing', tab] }); setEditing(null); setNewOpen(false); }} />
      )}
    </AdminShell>
  );
}

function MarketingEditor({ kind, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(defaultForm(kind, initial));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/marketing/${kind}/${initial.id}` : `/api/admin/marketing/${kind}`;
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow={kind.charAt(0).toUpperCase() + kind.slice(1, -1)} title={isEdit ? 'Edit' : `New ${kind.slice(0, -1)}`}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      {kind === 'announcements' && <AnnouncementForm form={form} setForm={setForm} />}
      {kind === 'campaigns'     && <CampaignForm    form={form} setForm={setForm} />}
      {kind === 'reviews'       && <ReviewForm      form={form} setForm={setForm} />}
      {kind === 'testimonials'  && <TestimonialForm form={form} setForm={setForm} />}
    </Drawer>
  );
}

function defaultForm(kind, initial) {
  if (kind === 'announcements') return { body: '', kind: 'bar', ctaLabel: '', ctaHref: '', active: true, ...(initial || {}) };
  if (kind === 'campaigns')     return { name: '', templateId: '', segmentQuery: '', status: 'draft', ...(initial || {}) };
  if (kind === 'reviews')       return { rating: 5, body: '', author: '', source: 'google', respondedAt: null, ...(initial || {}) };
  return { body: '', author: '', active: true, ...(initial || {}) };
}

function AnnouncementForm({ form, setForm }) {
  return (
    <div className="space-y-3">
      <Field label="Message" required><Input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="First session complimentary this month." /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placement">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="bar">Top bar</option><option value="popup">Popup</option>
          </Select>
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 mt-2 text-[13px]"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Live on site</label>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA label"><Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Book now" /></Field>
        <Field label="CTA link"><Input value={form.ctaHref} onChange={(e) => setForm({ ...form, ctaHref: e.target.value })} placeholder="/book" /></Field>
      </div>
    </div>
  );
}

function CampaignForm({ form, setForm }) {
  return (
    <div className="space-y-3">
      <Field label="Campaign name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="July float-week" /></Field>
      <Field label="Template key"><Input value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} placeholder="e.g. announce_float_week" /></Field>
      <Field label="Segment (Mongo filter JSON)"><Textarea rows={3} value={form.segmentQuery} onChange={(e) => setForm({ ...form, segmentQuery: e.target.value })} placeholder='{"tags":"vip"}' /></Field>
      <Field label="Status">
        <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option>
        </Select>
      </Field>
      <div className="text-[11.5px] text-muted-foreground">Send functionality requires WhatsApp/Email API keys — configure in Settings → Integrations.</div>
    </div>
  );
}

function ReviewForm({ form, setForm }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rating">
          <Select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
            {[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="google">Google</option><option value="in-app">In-app</option><option value="whatsapp">WhatsApp</option><option value="walk-in">Walk-in</option>
          </Select>
        </Field>
      </div>
      <Field label="Quote" required><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      <Field label="Author" required><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
    </div>
  );
}

function TestimonialForm({ form, setForm }) {
  return (
    <div className="space-y-3">
      <Field label="Quote" required><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      <Field label="Author" required><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Feature on homepage</label>
    </div>
  );
}

function rowActions(setEditing, remove) {
  return (r) => (
    <div className="flex items-center gap-1 justify-end">
      <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
      <button onClick={(e) => { e.stopPropagation(); remove(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function Chip({ children, cls }) {
  const map = { emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' };
  return <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${map[cls] || 'bg-muted text-muted-foreground'}`}>{children}</span>;
}
