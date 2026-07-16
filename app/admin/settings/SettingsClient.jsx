'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, Key, ShieldCheck } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';
import { ROLES } from '@/lib/permissions';

const TABS = [
  { key: 'business',     label: 'Business hours' },
  { key: 'taxes',        label: 'Taxes'          },
  { key: 'brand',        label: 'Brand'          },
  { key: 'resources',    label: 'Resources'      },
  { key: 'staff',        label: 'Staff & roles'  },
  { key: 'integrations', label: 'Integrations'   },
  { key: 'analytics',    label: 'Analytics'      },
];

export default function SettingsClient({ user }) {
  const [tab, setTab] = useState('business');
  return (
    <AdminShell user={user} title="Settings">
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="Business hours, taxes, resources, staff, integrations and API keys." />
      <AdminSection>
        <div className="mb-4"><Tabs items={TABS} active={tab} onChange={setTab} /></div>
        {tab === 'business'     && <BusinessHours />}
        {tab === 'taxes'        && <Taxes />}
        {tab === 'brand'        && <Brand />}
        {tab === 'resources'    && <Resources />}
        {tab === 'staff'        && <StaffRoles user={user} />}
        {tab === 'integrations' && <Integrations user={user} />}
        {tab === 'analytics'    && <AnalyticsTab />}
      </AdminSection>
    </AdminShell>
  );
}

/* ---------- Business hours ---------- */
function BusinessHours() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings', 'business'], queryFn: async () => (await fetch('/api/admin/settings/business')).json() });
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (form) return;
    setForm(data || defaultHours());
  }, [data]);
  const [saving, setSaving] = useState(false);
  if (!form) return <div className="text-[12.5px] text-muted-foreground">Loading…</div>;
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/business', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('failed');
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['settings', 'business'] });
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  const setDay = (day, patch) => setForm({ ...form, hours: { ...form.hours, [day]: { ...form.hours[day], ...patch } } });

  return (
    <div className="max-w-[720px]">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Weekly schedule</div>
        <div className="mt-4 space-y-2">
          {DAYS.map((day) => {
            const d = form.hours[day];
            return (
              <div key={day} className="grid grid-cols-12 gap-3 items-center">
                <label className="col-span-3 text-[13px] font-medium capitalize flex items-center gap-2">
                  <input type="checkbox" checked={d.open} onChange={(e) => setDay(day, { open: e.target.checked })} className="h-4 w-4" />
                  {day}
                </label>
                <div className="col-span-9 grid grid-cols-2 gap-3">
                  <input disabled={!d.open} type="time" value={d.from} onChange={(e) => setDay(day, { from: e.target.value })} className="h-9 px-3 rounded-md border border-input bg-background text-[13px] disabled:opacity-50" />
                  <input disabled={!d.open} type="time" value={d.to}   onChange={(e) => setDay(day, { to: e.target.value })}   className="h-9 px-3 rounded-md border border-input bg-background text-[13px] disabled:opacity-50" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <PrimaryBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save hours</PrimaryBtn>
      </div>
    </div>
  );
}
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
function defaultHours() {
  return { hours: Object.fromEntries(DAYS.map((d) => [d, { open: true, from: '06:00', to: '21:00' }])) };
}

/* ---------- Taxes ---------- */
function Taxes() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings', 'taxes'], queryFn: async () => (await fetch('/api/admin/settings/taxes')).json() });
  const [form, setForm] = useState(null);
  useEffect(() => { if (!form) setForm(data || { gstRate: 18, cgstRate: 9, sgstRate: 9, gstin: '29ABLCS6657A1Z0', hsnServices: '999722' }); }, [data]);
  const [saving, setSaving] = useState(false);
  if (!form) return <div className="text-[12.5px] text-muted-foreground">Loading…</div>;
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/taxes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('failed');
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['settings', 'taxes'] });
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <div className="max-w-[560px] space-y-3">
      <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="GST %"><Input type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} /></Field>
        <Field label="CGST %"><Input type="number" value={form.cgstRate} onChange={(e) => setForm({ ...form, cgstRate: Number(e.target.value) })} /></Field>
        <Field label="SGST %"><Input type="number" value={form.sgstRate} onChange={(e) => setForm({ ...form, sgstRate: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Default HSN (services)"><Input value={form.hsnServices} onChange={(e) => setForm({ ...form, hsnServices: e.target.value })} /></Field>
      <PrimaryBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save taxes</PrimaryBtn>
    </div>
  );
}

/* ---------- Brand ---------- */
function Brand() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings', 'brand'], queryFn: async () => (await fetch('/api/admin/settings/brand')).json() });
  const [form, setForm] = useState(null);
  useEffect(() => { if (!form) setForm(data || { name: 'Salt World', legalName: 'SSALT WELLNESS SPACES PRIVATE LIMITED', tagline: 'A wellness sanctuary in Bengaluru', phone: '+917687878793', email: 'info@saltworld.in', address: 'Site 1, 2nd floor, 18th Main, HSR Layout, Sector 3, Bengaluru 560102', whatsapp: '917687878793' }); }, [data]);
  const [saving, setSaving] = useState(false);
  if (!form) return <div className="text-[12.5px] text-muted-foreground">Loading…</div>;
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('failed');
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['settings', 'brand'] });
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <div className="max-w-[560px] space-y-3">
      <Field label="Trading name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Legal entity name"><Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></Field>
      <Field label="Tagline"><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="WhatsApp (E.164 digits)"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
      </div>
      <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      <PrimaryBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save brand</PrimaryBtn>
    </div>
  );
}

/* ---------- Analytics ---------- */
function AnalyticsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings', 'analytics'], queryFn: async () => (await fetch('/api/admin/settings/analytics')).json() });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data || {}); }, [data]);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/analytics', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success('Analytics tags saved. Live in ~10 seconds.');
      qc.invalidateQueries({ queryKey: ['settings', 'analytics'] });
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  const items = [
    { key: 'gtmId',        label: 'Google Tag Manager container ID', hint: 'e.g. GTM-XXXXXXX', placeholder: 'GTM-XXXXXXX' },
    { key: 'ga4Id',        label: 'Google Analytics 4 measurement ID', hint: 'e.g. G-XXXXXXXXXX', placeholder: 'G-XXXXXXXXXX' },
    { key: 'metaPixelId',  label: 'Meta Pixel ID', hint: 'Facebook / Instagram tracking', placeholder: '000000000000000' },
    { key: 'googleAdsId',  label: 'Google Ads conversion ID', hint: 'e.g. AW-XXXXXXXXXX', placeholder: 'AW-XXXXXXXXXX' },
    { key: 'clarityId',    label: 'Microsoft Clarity project ID', hint: 'From clarity.microsoft.com', placeholder: 'xxxxxxxxxx' },
  ];
  return (
    <div className="max-w-[720px] space-y-4">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3.5 text-[12.5px] leading-[1.5]">
        <div className="font-semibold text-[13px] mb-0.5">Marketing tracking</div>
        Add any of the IDs below. Leave blank to disable. Changes go live within ~10 seconds — no re-deploy required.
      </div>
      {items.map((it) => (
        <Field key={it.key} label={it.label} hint={it.hint}>
          <Input value={form[it.key] || ''} onChange={(e) => setForm({ ...form, [it.key]: e.target.value.trim() })} placeholder={it.placeholder} />
        </Field>
      ))}
      <PrimaryBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save analytics</PrimaryBtn>
    </div>
  );
}

/* ---------- Resources ---------- */
function Resources() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['resources'], queryFn: async () => (await fetch('/api/admin/resources')).json() });
  const [newOpen, setNewOpen] = useState(false);
  const remove = async (id) => {
    if (!confirm('Delete resource?')) return;
    const res = await fetch(`/api/admin/resources/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['resources'] }); }
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12.5px] text-muted-foreground">Physical rooms and equipment that get booked.</div>
        <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New resource</PrimaryBtn>
      </div>
      <SimpleTable
        columns={[
          { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'type', label: 'Type', render: (r) => <span className="capitalize text-[12.5px]">{(r.type || '').replace('_', ' ')}</span> },
          { key: 'capacity', label: 'Capacity' },
          { key: 'active', label: 'Status', render: (r) => r.active ? <span className="text-emerald-600 text-[11.5px]">Active</span> : <span className="text-muted-foreground text-[11.5px]">Inactive</span> },
          { key: 'actions', label: '', render: (r) => (
            <button onClick={() => remove(r.id)} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
          )},
        ]}
        rows={data}
        isLoading={isLoading}
        empty="No resources yet."
      />
      {newOpen && <NewResource onClose={() => setNewOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['resources'] }); setNewOpen(false); }} />}
    </div>
  );
}

function NewResource({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', type: 'float_tank', capacity: 1 });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, capacity: Number(form.capacity) }) });
      if (!res.ok) throw new Error('failed');
      toast.success('Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Resource" title="New resource"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Float Tank 3" /></Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['float_tank','salt_cave','sauna','plunge','red_light','other'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Capacity"><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}

/* ---------- Staff & Roles ---------- */
function StaffRoles({ user }) {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: async () => (await fetch('/api/admin/users')).json(), enabled: user.role === 'super_admin' });
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();

  if (user.role !== 'super_admin') {
    return <div className="rounded-md border border-border bg-card p-6 text-[13px]">Only Super Admin can manage staff and roles.</div>;
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {Object.values(ROLES).map((r) => (
          <div key={r.key} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <div className="font-medium text-[13.5px]">{r.label}</div>
            </div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">{r.description}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {r.permissions === '*' ? 'All permissions' : `${r.permissions.length} permission${r.permissions.length === 1 ? '' : 's'}`}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Staff accounts</div>
        <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> Invite staff</PrimaryBtn>
      </div>
      <SimpleTable
        columns={[
          { key: 'name',  label: 'Name',  render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'email', label: 'Email' },
          { key: 'role',  label: 'Role',  render: (r) => <span className="capitalize text-[12px]">{r.role.replace('_', ' ')}</span> },
          { key: 'status',label: 'Status',render: (r) => r.status === 'active' ? <span className="text-emerald-600 text-[11.5px]">Active</span> : <span className="text-muted-foreground text-[11.5px]">Disabled</span> },
          { key: 'lastLoginAt', label: 'Last login', render: (r) => r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : 'Never' },
        ]}
        rows={users}
        isLoading={isLoading}
        empty="No staff yet."
      />
      {newOpen && <InviteStaff onClose={() => setNewOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['users'] }); setNewOpen(false); }} />}
    </div>
  );
}

function InviteStaff({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'reception', password: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'failed');
      toast.success('Staff invited');
      onSaved();
    } catch (e) { toast.error(`Could not invite: ${e.message}`); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Staff" title="Invite staff member"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Invite'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Work email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Initial password" required hint="They can reset it after first login.">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      </div>
    </Drawer>
  );
}

/* ---------- Integrations ---------- */
function Integrations({ user }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['integrations'], queryFn: async () => (await fetch('/api/admin/integrations')).json() });
  const [editing, setEditing] = useState(null);
  const CATALOG = [
    { key: 'razorpay', name: 'Razorpay',   desc: 'Card / UPI / netbanking checkout for the customer site.', fields: ['keyId', 'keySecret', 'webhookSecret'] },
    { key: 'whatsapp', name: 'WhatsApp Cloud API', desc: 'Send booking confirmations and reminders via WhatsApp.', fields: ['phoneNumberId', 'accessToken', 'appSecret'] },
    { key: 'email',    name: 'Email (SendGrid / Resend)', desc: 'Transactional emails for confirmations and reset links.', fields: ['apiKey', 'fromAddress', 'fromName'] },
    { key: 's3',       name: 'AWS S3', desc: 'Media library storage for the CMS.', fields: ['bucket', 'region', 'accessKeyId', 'secretAccessKey', 'cdnUrl'] },
    { key: 'openai',   name: 'OpenAI / Claude', desc: 'AI Assistant, copywriter and dashboard insights.', fields: ['provider', 'apiKey', 'model'] },
    { key: 'google_reviews', name: 'Google Reviews', desc: 'Sync live reviews to the homepage.', fields: ['placeId', 'apiKey'] },
  ];
  const configuredMap = Object.fromEntries((data || []).map((d) => [d.key, d]));
  return (
    <div>
      <div className="text-[12.5px] text-muted-foreground mb-4">API keys are stored on the server. Secrets are masked on read — only Super Admin can update.</div>
      <div className="grid md:grid-cols-2 gap-3">
        {CATALOG.map((int) => {
          const cfg = configuredMap[int.key];
          const isConfigured = cfg?.configured;
          return (
            <div key={int.key} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[13.5px]">{int.name}</div>
                    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${isConfigured ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {isConfigured ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-1 max-w-[300px]">{int.desc}</div>
                </div>
                <button onClick={() => setEditing(int)} disabled={user.role !== 'super_admin'}
                  className="h-8 px-3 rounded-md border border-border text-[12px] font-medium hover:bg-muted disabled:opacity-50">
                  {isConfigured ? 'Update' : 'Connect'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {editing && <IntegrationEditor int={editing} current={configuredMap[editing.key]} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ['integrations'] }); setEditing(null); }} />}
    </div>
  );
}

function IntegrationEditor({ int, current, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(int.fields.map((f) => [f, current?.config?.[f] || ''])));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/integrations/${int.key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('failed');
      toast.success('Saved');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Integration" title={int.name}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save keys'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <div className="rounded-md bg-muted p-3 text-[12px] text-muted-foreground flex items-start gap-2">
          <Key className="h-3.5 w-3.5 mt-0.5" /><div>Keys are stored server-side. Existing values are masked — leaving a field blank keeps the previous value.</div>
        </div>
        {int.fields.map((f) => (
          <Field key={f} label={humanise(f)}>
            <Input type={/secret|key|token|password/i.test(f) ? 'password' : 'text'} value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} placeholder={current?.config?.[f] || ''} />
          </Field>
        ))}
      </div>
    </Drawer>
  );
}

function humanise(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}
