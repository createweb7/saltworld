'use client';

// Admin → Calendar Blocks
// Block bookable time for maintenance / holidays / private events across
// entire branches, specific therapies, or specific resources.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';

const REASONS = [
  { value: 'maintenance',        label: 'Maintenance' },
  { value: 'holiday',            label: 'Holiday' },
  { value: 'staff_leave',        label: 'Staff Leave' },
  { value: 'private_event',      label: 'Private Event / Group Booking' },
  { value: 'equipment_servicing',label: 'Equipment Servicing' },
  { value: 'group_booking',      label: 'Group Booking' },
  { value: 'other',              label: 'Other' },
];

const SCOPES = [
  { value: 'branch',   label: 'Entire Branch',   hint: 'Nothing bookable at this branch during the range.' },
  { value: 'therapy',  label: 'Specific Therapy',hint: 'Only the selected therapy is blocked (all resources).' },
  { value: 'resource', label: 'Specific Resource', hint: 'A single tank / room offline for maintenance.' },
];

const DAY_PARTS = [
  { value: 'full',   label: 'Full Day (00:00 – 23:59)' },
  { value: 'morning',label: 'Morning (06:00 – 12:00)' },
  { value: 'evening',label: 'Evening (17:00 – 22:00)' },
  { value: 'custom', label: 'Custom Time Range' },
];

async function fetchBlocks() {
  // fetch a wide window: 60 days back + 365 forward
  const from = new Date(Date.now() - 60 * 86400000).toISOString();
  const to   = new Date(Date.now() + 365 * 86400000).toISOString();
  const res = await fetch(`/api/admin/calendar-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchBranches()  { const r = await fetch('/api/admin/branches');            return r.ok ? r.json() : []; }
async function fetchTherapies() { const r = await fetch('/api/admin/services/therapies');  return r.ok ? r.json() : []; }
async function fetchResources() { const r = await fetch('/api/admin/resources');           return r.ok ? r.json() : []; }

export default function CalendarBlocksClient({ user }) {
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { data: blocks = [], isLoading } = useQuery({ queryKey: ['calendar-blocks'], queryFn: fetchBlocks });

  const { active, past } = useMemo(() => {
    const now = Date.now();
    const active = [], past = [];
    for (const b of blocks) {
      if (new Date(b.endAt).getTime() < now) past.push(b);
      else active.push(b);
    }
    return { active, past };
  }, [blocks]);

  const remove = async (row) => {
    if (!confirm(`Delete this ${row.scope} block?`)) return;
    try {
      const res = await fetch(`/api/admin/calendar-blocks/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Block removed');
      qc.invalidateQueries({ queryKey: ['calendar-blocks'] });
    } catch { toast.error('Could not delete'); }
  };

  const cols = [
    { key: 'scope', label: 'Scope', render: (r) => <ScopeChip block={r} /> },
    { key: 'range', label: 'When',  render: (r) => <RangeText block={r} /> },
    { key: 'reason',label: 'Reason', render: (r) => (
      <div>
        <div className="text-[13px] font-medium capitalize">{r.reason.replace(/_/g, ' ')}</div>
        {r.reasonNote && <div className="text-[11.5px] text-muted-foreground mt-0.5 max-w-xs truncate">{r.reasonNote}</div>}
      </div>
    )},
    { key: 'actions', label: '', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )},
  ];

  return (
    <AdminShell user={user} title="Calendar Blocks" actions={<PrimaryBtn onClick={() => setCreating(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New block</PrimaryBtn>}>
      <PageHeader eyebrow="Operate" title="Calendar Blocks" subtitle="Reserve blocks of time when the branch, a therapy, or a specific resource is unavailable to customers." />

      <AdminSection>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 mb-4 flex gap-3 items-start">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[12.5px] leading-[1.55] text-muted-foreground">
            <div className="text-foreground font-medium">How this works</div>
            Blocks are honoured automatically by the booking engine: customers won’t see slots during the block, and any attempt to book at a blocked time returns an unavailable response.
            Delete a block to instantly restore availability. Blocks scoped to a resource take effect only for that resource.
          </div>
        </div>

        <SectionTitle>Active & upcoming ({active.length})</SectionTitle>
        <SimpleTable columns={cols} rows={active} isLoading={isLoading} empty="No active blocks. Click ‘New block’ to add one." />

        {past.length > 0 && (
          <div className="mt-8">
            <SectionTitle>Past ({past.length})</SectionTitle>
            <SimpleTable columns={cols} rows={past.slice(0, 40)} empty="—" />
          </div>
        )}
      </AdminSection>

      {creating && (
        <BlockEditor onClose={() => setCreating(false)} onSaved={() => {
          qc.invalidateQueries({ queryKey: ['calendar-blocks'] });
          setCreating(false);
        }} />
      )}
    </AdminShell>
  );
}

function SectionTitle({ children }) {
  return <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-3">{children}</div>;
}

function ScopeChip({ block }) {
  const colors = {
    branch:  'bg-red-500/10 text-red-700 dark:text-red-400',
    therapy: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    resource:'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  };
  return (
    <div>
      <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] ${colors[block.scope] || ''}`}>
        <CalendarOff className="h-3 w-3 mr-1" />{block.scope}
      </span>
      {block.therapySlug && <div className="text-[11.5px] text-muted-foreground mt-1">Therapy: <span className="font-mono">{block.therapySlug}</span></div>}
      {block.resourceId  && <div className="text-[11.5px] text-muted-foreground mt-1 truncate" title={block.resourceId}>Resource: <span className="font-mono">{block.resourceId.slice(0,8)}…</span></div>}
    </div>
  );
}

function RangeText({ block }) {
  const from = new Date(block.startAt);
  const to   = new Date(block.endAt);
  const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  const sameDay = from.toISOString().slice(0,10) === to.toISOString().slice(0,10);
  return (
    <div className="text-[12.5px]">
      <div className="font-medium">{fmtDate(from)}{!sameDay && <> → {fmtDate(to)}</>}</div>
      <div className="text-muted-foreground">{fmtTime(from)} – {fmtTime(to)} IST</div>
    </div>
  );
}

/* ================================================================ */
/*  Editor                                                          */
/* ================================================================ */

function BlockEditor({ onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    scope: 'branch',
    branchId: '',
    therapySlug: '',
    resourceId: '',
    date: today,
    dayPart: 'full',
    startTime: '10:00',
    endTime:   '13:00',
    reason: 'maintenance',
    reasonNote: '',
  });
  const [saving, setSaving] = useState(false);
  const { data: branches  = [] } = useQuery({ queryKey: ['branches-lookup'],  queryFn: fetchBranches });
  const { data: therapies = [] } = useQuery({ queryKey: ['therapies-lookup'], queryFn: fetchTherapies });
  const { data: resources = [] } = useQuery({ queryKey: ['resources-lookup'], queryFn: fetchResources });

  const filteredResources = form.branchId
    ? resources.filter((r) => r.branchId === form.branchId)
    : resources;

  const save = async () => {
    if (!form.reason) return toast.error('Reason required');
    // Compute startAt / endAt in ISO UTC based on dayPart + IST wall clock.
    const toIso = (date, hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      const utc = new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);
      utc.setUTCMinutes(utc.getUTCMinutes() - 330); // IST → UTC
      return utc.toISOString();
    };
    let startAt, endAt;
    if (form.dayPart === 'full')    { startAt = toIso(form.date, '00:00'); endAt = toIso(form.date, '23:59'); }
    else if (form.dayPart === 'morning') { startAt = toIso(form.date, '06:00'); endAt = toIso(form.date, '12:00'); }
    else if (form.dayPart === 'evening') { startAt = toIso(form.date, '17:00'); endAt = toIso(form.date, '22:00'); }
    else                                 { startAt = toIso(form.date, form.startTime); endAt = toIso(form.date, form.endTime); }

    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return toast.error('End must be after start');

    const payload = {
      scope: form.scope,
      branchId:    form.scope === 'branch' ? (form.branchId || null) : (form.branchId || null),
      therapySlug: form.scope === 'therapy'  ? form.therapySlug : null,
      resourceId:  form.scope === 'resource' ? form.resourceId  : null,
      startAt, endAt,
      reason: form.reason,
      reasonNote: form.reasonNote,
    };
    if (form.scope === 'therapy'  && !form.therapySlug) return toast.error('Choose a therapy');
    if (form.scope === 'resource' && !form.resourceId)  return toast.error('Choose a resource');

    setSaving(true);
    try {
      const res = await fetch('/api/admin/calendar-blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'failed');
      }
      toast.success('Block created');
      onSaved();
    } catch (e) { toast.error(String(e.message || 'Could not save')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open onClose={onClose} eyebrow="New" title="Block calendar time"
      footer={<div className="flex items-center justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create block'}</PrimaryBtn></div>}
    >
      <div className="space-y-4">
        <Field label="What is being blocked?" required>
          <div className="grid grid-cols-1 gap-2">
            {SCOPES.map((s) => (
              <label key={s.value}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${form.scope === s.value ? 'border-brand bg-brand-soft/40' : 'border-border hover:border-foreground/30'}`}>
                <input type="radio" name="scope" value={s.value} checked={form.scope === s.value} onChange={() => setForm({ ...form, scope: s.value })} className="sr-only" />
                <div className="flex items-center gap-2">
                  <div className={`h-3.5 w-3.5 rounded-full border-2 ${form.scope === s.value ? 'border-brand bg-brand' : 'border-border'}`} />
                  <div className="text-[13px] font-medium">{s.label}</div>
                </div>
                <div className="mt-1 text-[11.5px] text-muted-foreground leading-[1.45] ml-5.5">{s.hint}</div>
              </label>
            ))}
          </div>
        </Field>

        {branches.length > 1 && (
          <Field label="Branch" hint={form.scope === 'branch' ? 'Leave blank to close ALL branches' : 'Restricts the therapy/resource to this branch'}>
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}

        {form.scope === 'therapy' && (
          <Field label="Therapy" required>
            <Select value={form.therapySlug} onChange={(e) => setForm({ ...form, therapySlug: e.target.value })}>
              <option value="">Pick a therapy…</option>
              {therapies.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </Select>
          </Field>
        )}

        {form.scope === 'resource' && (
          <Field label="Resource" required>
            <Select value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })}>
              <option value="">Pick a resource…</option>
              {filteredResources.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.type}</option>)}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Duration">
            <Select value={form.dayPart} onChange={(e) => setForm({ ...form, dayPart: e.target.value })}>
              {DAY_PARTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          </Field>
        </div>

        {form.dayPart === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
            <Field label="End time"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
          </div>
        )}

        <Field label="Reason" required>
          <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>

        <Field label="Note (visible to admin only)" hint="E.g. ‘Corporate event — Cred team’ or ‘Tank 1 chiller replacement’.">
          <Textarea rows={2} value={form.reasonNote} onChange={(e) => setForm({ ...form, reasonNote: e.target.value })} placeholder="Optional context…" />
        </Field>
      </div>
    </Drawer>
  );
}
