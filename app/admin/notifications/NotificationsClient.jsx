'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Mail, MessageCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';

const DEFAULT_TEMPLATES = [
  { key: 'booking_confirmation', label: 'Booking confirmation', channels: ['email', 'whatsapp'] },
  { key: 'booking_reminder',     label: 'Booking reminder',     channels: ['whatsapp', 'sms'] },
  { key: 'review_request',       label: 'Review request',       channels: ['whatsapp', 'email'] },
  { key: 'membership_expiry',    label: 'Membership expiry',    channels: ['email'] },
  { key: 'birthday',             label: 'Birthday',             channels: ['whatsapp'] },
  { key: 'anniversary',          label: 'Anniversary',          channels: ['whatsapp'] },
];

async function fetchTemplates() {
  const res = await fetch('/api/admin/notifications/templates');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchLogs() {
  const res = await fetch('/api/admin/notifications/logs');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function NotificationsClient({ user }) {
  const [tab, setTab] = useState('templates');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const tpl = useQuery({ queryKey: ['tpl'],  queryFn: fetchTemplates, enabled: tab === 'templates' });
  const log = useQuery({ queryKey: ['tlog'], queryFn: fetchLogs,      enabled: tab === 'logs' });

  const removeTpl = async (id) => {
    if (!confirm('Delete template?')) return;
    const res = await fetch(`/api/admin/notifications/templates/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['tpl'] }); }
  };

  return (
    <AdminShell user={user} title="Notifications" actions={
      tab === 'templates' && <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New template</PrimaryBtn>
    }>
      <PageHeader eyebrow="Comms" title="Notifications" subtitle="Templates for booking confirmations, reminders, review requests and lifecycle nudges." />
      <AdminSection>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-amber-800 dark:text-amber-300">Provider keys not configured</div>
            <div className="text-[12px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Add WhatsApp Cloud API + Email (SendGrid/Resend) credentials in <a href="/admin/settings" className="underline underline-offset-4">Settings → Integrations</a>. Until then, sends are queued locally without dispatching.
            </div>
          </div>
        </div>

        <div className="mb-4">
          <Tabs items={[
            { key: 'templates', label: 'Templates', count: tpl.data?.length },
            { key: 'logs',      label: 'Delivery log', count: log.data?.length },
          ]} active={tab} onChange={setTab} />
        </div>

        {tab === 'templates' && (
          <>
            <SuggestedTemplates existing={tpl.data || []} qc={qc} />
            <SimpleTable
              columns={[
                { key: 'key',     label: 'Key',    render: (r) => <span className="font-mono text-[12.5px]">{r.key}</span> },
                { key: 'channel', label: 'Channel', render: (r) => <ChannelChip channel={r.channel} /> },
                { key: 'subject', label: 'Subject/preview', render: (r) => <span className="text-[13px] truncate max-w-[400px] inline-block">{r.subject || r.body?.slice(0, 60) || '—'}</span> },
                { key: 'active',  label: 'Status', render: (r) => r.active ? <span className="text-emerald-600 text-[11.5px]">Active</span> : <span className="text-muted-foreground text-[11.5px]">Inactive</span> },
                { key: 'actions', label: '', render: (r) => (
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeTpl(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )},
              ]}
              rows={tpl.data || []}
              isLoading={tpl.isLoading}
              empty="No templates yet — pick a starter above to get going."
            />
          </>
        )}

        {tab === 'logs' && (
          <SimpleTable
            columns={[
              { key: 'channel',    label: 'Channel',    render: (r) => <ChannelChip channel={r.channel} /> },
              { key: 'templateId', label: 'Template',   render: (r) => <span className="font-mono text-[12px]">{r.templateId || 'ad-hoc'}</span> },
              { key: 'customerId', label: 'Customer',   render: (r) => <span className="font-mono text-[12px]">{r.customerId?.slice(0, 8) || '—'}</span> },
              { key: 'status',     label: 'Status',     render: (r) => <span className="capitalize text-[12px]">{r.status}</span> },
              { key: 'sentAt',     label: 'When',       render: (r) => new Date(r.sentAt).toLocaleString() },
            ]}
            rows={log.data || []}
            isLoading={log.isLoading}
            empty="No messages sent yet."
          />
        )}
      </AdminSection>

      {(newOpen || editing) && (
        <TemplateEditor initial={editing} onClose={() => { setEditing(null); setNewOpen(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['tpl'] }); setEditing(null); setNewOpen(false); }} />
      )}
    </AdminShell>
  );
}

function SuggestedTemplates({ existing, qc }) {
  const [creating, setCreating] = useState(null);
  const existingKeys = new Set((existing || []).map((t) => t.key + '__' + t.channel));
  const missing = [];
  for (const d of DEFAULT_TEMPLATES) for (const ch of d.channels) if (!existingKeys.has(d.key + '__' + ch)) missing.push({ ...d, channel: ch });
  if (missing.length === 0) return null;
  const seed = async (item) => {
    setCreating(item.key + '_' + item.channel);
    try {
      const res = await fetch('/api/admin/notifications/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: item.key, channel: item.channel,
          subject: item.channel === 'email' ? item.label : '',
          body: `Hi {{name}}, this is a ${item.label.toLowerCase()} from Salt World.`,
          variables: ['name'],
          active: true,
        }),
      });
      if (res.ok) { toast.success('Template added'); qc.invalidateQueries({ queryKey: ['tpl'] }); }
    } finally { setCreating(null); }
  };
  return (
    <div className="mb-6">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Recommended starters</div>
      <div className="flex flex-wrap gap-2">
        {missing.slice(0, 8).map((m) => (
          <button key={m.key + m.channel} onClick={() => seed(m)}
            className="h-8 px-3 rounded-full border border-dashed border-border text-[12px] font-medium hover:bg-muted inline-flex items-center gap-1.5">
            <Plus className="h-3 w-3" /> {m.label} · <span className="capitalize">{m.channel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    key: initial?.key || '',
    channel: initial?.channel || 'email',
    subject: initial?.subject || '',
    body: initial?.body || '',
    variables: (initial?.variables || []).join(', '),
    active: initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, variables: form.variables.split(',').map((s) => s.trim()).filter(Boolean) };
      const url = isEdit ? `/api/admin/notifications/templates/${initial.id}` : '/api/admin/notifications/templates';
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Template" title={isEdit ? 'Edit template' : 'New template'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.key}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" required hint="e.g. booking_reminder"><Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></Field>
          <Field label="Channel"><Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></Select></Field>
        </div>
        {form.channel === 'email' && (
          <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
        )}
        <Field label="Body" hint="Variables like {{name}} will be interpolated on send.">
          <Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <Field label="Variables (comma separated)"><Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="name, bookingRef" /></Field>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Active</label>
      </div>
    </Drawer>
  );
}

function ChannelChip({ channel }) {
  const map = {
    email:    { Icon: Mail,           label: 'Email',    cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    whatsapp: { Icon: MessageCircle,  label: 'WhatsApp', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    sms:      { Icon: MessageSquare,  label: 'SMS',      cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  };
  const c = map[channel] || map.email;
  return <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10.5px] font-semibold ${c.cls}`}><c.Icon className="h-3 w-3" /> {c.label}</span>;
}
