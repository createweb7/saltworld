'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, MessageCircle, Wallet, Calendar,
  FileText, Heart, Loader2, Save, Plus,
} from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';

const TABS = [
  { key: 'overview',  label: 'Overview'  },
  { key: 'visits',    label: 'Visits'    },
  { key: 'membership',label: 'Membership'},
  { key: 'wallet',    label: 'Wallet'    },
  { key: 'giftcards', label: 'Gift cards'},
  { key: 'invoices',  label: 'Invoices'  },
  { key: 'medical',   label: 'Medical'   },
  { key: 'notes',     label: 'Notes'     },
  { key: 'comms',     label: 'Comms'     },
];

async function fetchCustomer(id) {
  const res = await fetch(`/api/admin/customers/${id}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function CustomerDetailClient({ user, id }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const { data, isLoading } = useQuery({ queryKey: ['customer', id], queryFn: () => fetchCustomer(id) });

  const c = data?.customer;

  const initials = (c?.name || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  const startNewBooking = () => {
    if (!c) return;
    const params = new URLSearchParams();
    if (c.name)  params.set('name',  c.name);
    if (c.phone) params.set('phone', c.phone);
    if (c.email) params.set('email', c.email);
    params.set('customerId', c.id);
    // Send staff to the public booking flow with contact pre-filled. Same flow handles
    // walk-ins, existing customers, membership redemption, and gift-card usage.
    router.push(`/book?${params.toString()}`);
  };

  return (
    <AdminShell
      user={user}
      title={c?.name || 'Customer'}
      actions={
        <Link href="/admin/customers" className="h-8 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-muted">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
      }
    >
      {isLoading && <div className="px-8 py-16 text-center text-muted-foreground"><Loader2 className="h-4 w-4 mx-auto animate-spin" /></div>}
      {c && (
        <>
          {/* Sticky profile header */}
          <div className="px-5 md:px-8 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-full bg-foreground text-background text-[16px] font-bold flex items-center justify-center shrink-0">{initials}</div>
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Customer</div>
                  <h1 className="mt-0.5 text-[22px] md:text-[26px] font-semibold tracking-tight">{c.name}</h1>
                  <div className="mt-1 flex items-center gap-3 text-[12.5px] text-muted-foreground flex-wrap">
                    {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    <span>· Since {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.disabled && (
                  <span className="h-6 px-2.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 text-[10.5px] uppercase tracking-[0.12em] font-semibold inline-flex items-center">Access disabled</span>
                )}
                {c.phone && (
                  <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium hover:bg-muted inline-flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <button type="button"
                  onClick={async () => {
                    const action = c.disabled ? 'enable' : 'disable';
                    if (!confirm(c.disabled ? 'Restore login access for this customer?' : 'Disable login access? The customer will not be able to sign in or verify OTP.')) return;
                    try {
                      const r = await fetch(`/api/admin/customers/${id}/${action}`, { method: 'POST' });
                      if (!r.ok) throw new Error();
                      toast.success(c.disabled ? 'Access restored' : 'Access disabled');
                      qc.invalidateQueries({ queryKey: ['customer', id] });
                    } catch { toast.error('Could not update access'); }
                  }}
                  className={cn('h-9 px-3 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5',
                    c.disabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-red-500/40 text-red-600 hover:bg-red-500/10')}>
                  {c.disabled ? 'Enable access' : 'Disable access'}
                </button>
                <button type="button" onClick={startNewBooking} className="h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New booking
                </button>
              </div>
            </div>

            {/* Info cards */}
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniCard icon={Wallet}   label="Wallet"        value={'\u20B9' + (c.walletBalance || 0)} />
              <MiniCard icon={Calendar} label="Visits"        value={data.visits?.length ?? 0} />
              <MiniCard icon={Heart}    label="Membership"    value={data.subscriptions?.[0]?.status === 'active' ? 'Active' : 'None'} />
              <MiniCard icon={FileText} label="Invoices"      value={data.invoices?.length ?? 0} />
            </div>

            {/* Tabs */}
            <div className="mt-6 flex items-center gap-0.5 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn('h-8 px-3 rounded-md text-[12.5px] font-medium whitespace-nowrap transition-colors',
                    tab === t.key ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <AdminSection>
            {tab === 'overview' && <OverviewTab customer={c} qc={qc} />}
            {tab === 'visits'   && <VisitsTab visits={data.visits} />}
            {tab === 'membership' && <ListTab items={data.subscriptions} empty="No membership yet." render={(s) => <div className="flex items-center justify-between"><div><div className="text-[13px] font-medium">{s.membershipId}</div><div className="text-[11px] text-muted-foreground">Started {new Date(s.startAt).toLocaleDateString()}</div></div><span className="text-[11px] uppercase tracking-[0.12em] font-semibold">{s.status}</span></div>} />}
            {tab === 'wallet'    && <WalletTab customerId={id} qc={qc} />}
            {tab === 'giftcards' && <ListTab items={data.giftcards} empty="No gift cards received or purchased." render={(g) => <div className="flex items-center justify-between"><div><div className="text-[13px] font-mono">{g.code}</div><div className="text-[11px] text-muted-foreground">Balance ₹{(g.balance||g.amount).toLocaleString('en-IN')}</div></div><span className="text-[11px] uppercase tracking-[0.12em] font-semibold">{g.status}</span></div>} />}
            {tab === 'invoices'  && <ListTab items={data.invoices} empty="No invoices yet." render={(i) => <div className="flex items-center justify-between"><div><div className="text-[13px] font-mono">{i.number}</div><div className="text-[11px] text-muted-foreground">{new Date(i.createdAt).toLocaleDateString()}</div></div><div className="text-[13px] font-medium">₹{(i.total||0).toLocaleString('en-IN')}</div></div>} />}
            {tab === 'medical'   && <MedicalTab customer={c} qc={qc} canEdit={user.role !== 'reception' && user.role !== 'marketing'} />}
            {tab === 'notes'     && <NotesTab notes={data.notes} customerId={id} qc={qc} />}
            {tab === 'comms'     && <ListTab items={data.communications} empty="No messages yet." render={(m) => <div className="flex items-start justify-between"><div><div className="text-[12.5px] font-medium capitalize">{m.channel} — {m.templateId || 'ad-hoc'}</div><div className="text-[11.5px] text-muted-foreground mt-0.5">{new Date(m.sentAt).toLocaleString()}</div></div><span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold">{m.status}</span></div>} />}
          </AdminSection>
        </>
      )}
    </AdminShell>
  );
}

function MiniCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold"><Icon className="h-3 w-3" /> {label}</div>
      <div className="mt-1.5 text-[16px] font-semibold">{value}</div>
    </div>
  );
}

function OverviewTab({ customer, qc }) {
  const [form, setForm] = useState({ name: customer.name, email: customer.email || '', phone: customer.phone || '', tags: (customer.tags || []).join(', ') });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean) }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['customer', customer.id] });
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <div className="max-w-[560px] space-y-3">
      <Field label="Full name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" /></Field>
      </div>
      <Field label="Tags"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, sleep-program" className="w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px]" /></Field>
      <button onClick={save} disabled={saving} className="h-10 px-4 rounded-md bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-70">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save changes
      </button>
    </div>
  );
}

function MedicalTab({ customer, qc, canEdit }) {
  const [val, setVal] = useState(customer.medicalNotes || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicalNotes: val }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Medical notes updated');
      qc.invalidateQueries({ queryKey: ['customer', customer.id] });
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <div className="max-w-[720px]">
      <div className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Medical notes</div>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} readOnly={!canEdit}
        rows={10} placeholder="Allergies, conditions, medications, contraindications…"
        className="mt-2 w-full px-3 py-3 rounded-md border border-input bg-background text-[13.5px] resize-y" />
      {canEdit && (
        <button onClick={save} disabled={saving} className="mt-3 h-10 px-4 rounded-md bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-70">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </button>
      )}
      {!canEdit && <div className="mt-3 text-[11.5px] text-muted-foreground">You don&rsquo;t have permission to edit medical notes.</div>}
    </div>
  );
}

function NotesTab({ notes = [], customerId, qc }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('failed');
      setBody(''); toast.success('Note added');
      qc.invalidateQueries({ queryKey: ['customer', customerId] });
    } catch { toast.error('Could not add note'); }
    finally { setSaving(false); }
  };
  return (
    <div className="max-w-[720px]">
      <div className="flex items-start gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Internal note…"
          className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-[13.5px] resize-y" />
        <button onClick={add} disabled={saving || !body.trim()} className="h-10 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold disabled:opacity-70 inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
        </button>
      </div>
      <div className="mt-5 space-y-2">
        {notes.length === 0 && <div className="text-[12.5px] text-muted-foreground">No notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-md border border-border bg-card px-3.5 py-2.5">
            <div className="text-[13px] whitespace-pre-wrap">{n.body}</div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">{n.authorName || 'Staff'} · {new Date(n.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitsTab({ visits = [] }) {
  if (visits.length === 0) return <div className="text-[12.5px] text-muted-foreground">No visits yet.</div>;
  return (
    <div className="space-y-2">
      {visits.map((v) => (
        <div key={v.id} className="rounded-md border border-border bg-card px-4 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium">{v.therapyId || 'Session'}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{new Date(v.startedAt).toLocaleString()}</div>
          </div>
          <div className="text-[11.5px] text-muted-foreground">{v.therapistId || '—'}</div>
        </div>
      ))}
    </div>
  );
}

function ListTab({ items = [], empty, render }) {
  if (items.length === 0) return <div className="text-[12.5px] text-muted-foreground">{empty}</div>;
  return (
    <div className="space-y-2 max-w-[720px]">
      {items.map((it) => (
        <div key={it.id} className="rounded-md border border-border bg-card px-4 py-2.5">{render(it)}</div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}


/* ================================================================ */
/*  Wallet tab — admin credit/debit with immutable ledger view      */
/* ================================================================ */

function WalletTab({ customerId, qc }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-wallet', customerId],
    queryFn: async () => (await fetch(`/api/admin/customers/${customerId}/wallet-history`)).json(),
  });
  const [open, setOpen] = useState(false);

  const balance = Number(data?.balance || 0);
  const rows = Array.isArray(data?.history) ? data.history : [];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Wallet balance</div>
          <div className="mt-1 font-serif text-4xl">₹{balance.toLocaleString('en-IN')}</div>
          <div className="text-[11.5px] text-muted-foreground mt-1">Every transaction below is immutable — records are never edited or deleted.</div>
        </div>
        <button onClick={() => setOpen(true)} className="h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-foreground/90">
          <Plus className="h-3.5 w-3.5" /> Adjust wallet
        </button>
      </div>

      {isLoading ? (
        <div className="text-[12.5px] text-muted-foreground py-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-[13px] text-muted-foreground text-center">No wallet activity yet.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted/50 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">When</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-left px-3 py-2 font-semibold">Note</th>
                <th className="text-right px-3 py-2 font-semibold">Amount</th>
                <th className="text-right px-3 py-2 font-semibold">Points</th>
                <th className="text-right px-3 py-2 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => {
                const isCredit = Number(tx.points) >= 0;
                return (
                  <tr key={tx.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(tx.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2"><span className="capitalize text-[11.5px] font-medium">{String(tx.type || '').replace(/_/g, ' ')}</span></td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={tx.note}>{tx.note || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{tx.amountInr ? `₹${Number(tx.amountInr).toLocaleString('en-IN')}` : '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>{isCredit ? '+' : ''}{tx.points}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{tx.balanceAfter}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <WalletAdjustDialog customerId={customerId} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refetch(); qc.invalidateQueries({ queryKey: ['customer', customerId] }); }} />}
    </div>
  );
}

function WalletAdjustDialog({ customerId, onClose, onSaved }) {
  const [direction, setDirection] = useState('credit');
  const [amount, setAmount] = useState(500);
  const [note, setNote]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState(null);
  const submit = async () => {
    if (!note.trim())    return setErr('Reason is required.');
    if (!amount || amount <= 0) return setErr('Amount must be greater than zero.');
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/wallet-adjust`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountInr: Number(amount), direction, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success(`Wallet ${direction === 'credit' ? 'credited' : 'debited'} ₹${amount}`);
      onSaved();
    } catch (e) { setErr(String(e.message || 'Could not adjust wallet')); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Adjust wallet</div>
        <h2 className="mt-1 font-serif text-2xl">Credit or debit customer wallet</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {['credit','debit'].map((d) => (
            <button key={d} type="button" onClick={() => setDirection(d)}
              className={`h-10 rounded-md border text-[12.5px] font-semibold capitalize transition-colors ${direction === d ? (d === 'credit' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400') : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {d === 'credit' ? '+ Credit' : '− Debit'}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Amount (₹)</label>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 font-mono text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
        <div className="mt-3">
          <label className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Reason (required)</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Goodwill credit for delayed session on 12 Feb"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
        </div>
        {err && <div className="mt-2 text-[12px] text-red-600">{err}</div>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={busy} className="h-9 px-4 rounded-md text-[12.5px] font-semibold bg-foreground text-background disabled:opacity-40 hover:bg-foreground/90">
            {busy ? 'Saving…' : `${direction === 'credit' ? 'Credit' : 'Debit'} ₹${amount}`}
          </button>
        </div>
      </div>
    </div>
  );
}
