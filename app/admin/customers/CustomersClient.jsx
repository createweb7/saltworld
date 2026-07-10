'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, ArrowRight, Loader2, User, Phone, Mail } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Drawer, Field, Input, PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';

async function fetchCustomers(q) {
  const url = q ? `/api/admin/customers?q=${encodeURIComponent(q)}` : '/api/admin/customers';
  const res = await fetch(url);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function CustomersClient({ user }) {
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['customers', q], queryFn: () => fetchCustomers(q) });

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div>
        <Link href={`/admin/customers/${r.id}`} className="font-medium hover:underline underline-offset-4">{r.name || '(no name)'}</Link>
        <div className="text-[11px] text-muted-foreground mt-0.5">Since {new Date(r.createdAt).toLocaleDateString()}</div>
      </div>
    )},
    { key: 'contact', label: 'Contact', render: (r) => (
      <div className="text-[12.5px] text-muted-foreground">
        {r.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{r.email}</div>}
        {r.phone && <div className="flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" />{r.phone}</div>}
        {!r.email && !r.phone && '\u2014'}
      </div>
    )},
    { key: 'tags', label: 'Tags', render: (r) => (
      <div className="flex flex-wrap gap-1">
        {(r.tags || []).length === 0 && <span className="text-muted-foreground">\u2014</span>}
        {(r.tags || []).slice(0, 3).map((t) => (
          <span key={t} className="h-5 px-2 rounded-full bg-muted text-[10.5px] font-medium text-muted-foreground inline-flex items-center">{t}</span>
        ))}
      </div>
    )},
    { key: 'lifetimeValue', label: 'LTV', className: 'text-right', render: (r) => (
      <span className="font-mono text-[12.5px]">{r.lifetimeValue ? '\u20B9' + r.lifetimeValue.toLocaleString('en-IN') : '\u2014'}</span>
    )},
    { key: 'actions', label: '', render: (r) => (
      <Link href={`/admin/customers/${r.id}`} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
        Open <ArrowRight className="h-3 w-3" />
      </Link>
    )},
  ];

  return (
    <AdminShell user={user} title="Customers"
      actions={
        <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3">
          <Plus className="h-3.5 w-3.5" /> New customer
        </PrimaryBtn>
      }
    >
      <PageHeader eyebrow="CRM" title="Customers" subtitle="Search by name, email or phone. Bulk actions coming next." />
      <AdminSection>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone\u2026"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="text-[12px] text-muted-foreground">{data.length} result{data.length === 1 ? '' : 's'}</div>
        </div>

        <SimpleTable
          columns={columns}
          rows={data}
          isLoading={isLoading}
          empty={
            <div className="py-4">
              <User className="h-6 w-6 mx-auto text-muted-foreground/50 mb-3" />
              <div className="text-[13px]">No customers yet.</div>
              <div className="text-[12px] text-muted-foreground mt-1">Add your first customer or import from your existing tools.</div>
              <PrimaryBtn onClick={() => setNewOpen(true)} className="mt-4 h-9 px-3">
                <Plus className="h-3.5 w-3.5" /> Add customer
              </PrimaryBtn>
            </div>
          }
        />
      </AdminSection>

      {newOpen && (
        <NewCustomerDrawer
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['customers'] });
            setNewOpen(false);
          }}
        />
      )}
    </AdminShell>
  );
}

function NewCustomerDrawer({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', tags: '' });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:  form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          tags:  form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      toast.success('Customer created');
      onCreated();
    } catch (e) {
      toast.error(`Could not create customer: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="CRM"
      title="New customer"
      footer={
        <div className="flex items-center justify-end gap-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={loading || !form.name.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-3.5 w-3.5" /> Create customer</>}
          </PrimaryBtn>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
        <Field label="Full name" required>
          <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91\u2026" />
          </Field>
        </div>
        <Field label="Tags (comma-separated)">
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, sleep-program" />
        </Field>
        {/* Hidden submit so pressing Enter in an input submits via the same handler */}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Drawer>
  );
}
