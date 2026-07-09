'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, ArrowRight, Loader2, User, Phone, Mail } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';

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

  return (
    <AdminShell
      user={user}
      title="Customers"
      actions={
        <button onClick={() => setNewOpen(true)}
          className="h-8 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New customer
        </button>
      }
    >
      <PageHeader eyebrow="CRM" title="Customers" subtitle="Search by name, email or phone. Bulk actions coming next." />

      <AdminSection>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone…"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="text-[12px] text-muted-foreground">{data.length} result{data.length === 1 ? '' : 's'}</div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted/40">
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Contact</th>
                <th className="px-4 py-2.5 font-semibold">Tags</th>
                <th className="px-4 py-2.5 font-semibold text-right">LTV</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-[12.5px]"><Loader2 className="h-4 w-4 mx-auto animate-spin" /></td></tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-16 text-center">
                  <User className="h-6 w-6 mx-auto text-muted-foreground/50 mb-3" />
                  <div className="text-[13px]">No customers yet.</div>
                  <div className="text-[12px] text-muted-foreground mt-1">Add your first customer or import from your existing tools.</div>
                  <button onClick={() => setNewOpen(true)} className="mt-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold">
                    <Plus className="h-3.5 w-3.5" /> Add customer
                  </button>
                </td></tr>
              )}
              {data.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-[13px] hover:underline underline-offset-4">{c.name || '(no name)'}</Link>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Since {new Date(c.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted-foreground">
                    {c.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email}</div>}
                    {c.phone && <div className="flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" /> {c.phone}</div>}
                    {!c.email && !c.phone && '—'}
                  </td>
                  <td className="px-4 py-3">
                    {(c.tags || []).length === 0 && <span className="text-[12px] text-muted-foreground">—</span>}
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="h-5 px-2 rounded-full bg-muted text-[10.5px] font-medium text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12.5px]">{c.lifetimeValue ? '₹' + c.lifetimeValue.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/customers/${c.id}`} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>

      {newOpen && (
        <NewCustomerDrawer onClose={() => setNewOpen(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer created'); setNewOpen(false); }} />
      )}
    </AdminShell>
  );
}

function NewCustomerDrawer({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', tags: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone,
          tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error('failed');
      onCreated();
    } catch { toast.error('Could not create customer.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] bg-background border-l border-border p-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">CRM</div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">New customer</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground">✕</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <Field label="Full name" required>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91…" className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" />
            </Field>
          </div>
          <Field label="Tags (comma-separated)">
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="vip, sleep-program" className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" />
          </Field>
          <button type="submit" disabled={loading}
            className="mt-2 w-full h-10 rounded-md bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create customer <ArrowRight className="h-3.5 w-3.5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
        {label}{required && <span className="text-brand ml-1">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
