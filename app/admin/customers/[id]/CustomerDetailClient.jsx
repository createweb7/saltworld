'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, MessageCircle, Wallet, Calendar,
  FileText, Heart, Loader2, Save, Plus, Snowflake, Play, X, Sliders, CalendarPlus, CreditCard,
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
    // Flag the flow as staff-driven so BookingClient re-enables the
    // "Pay at reception" option (customers-only get pay-online).
    params.set('staff', '1');
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
              <MiniCard icon={Wallet}   label="Wallet"        value={'\u20B9' + (c.walletBalanceInr ?? 0).toLocaleString('en-IN')} />
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
            {tab === 'membership' && <MembershipsTab subs={data.subscriptions} customerId={id} qc={qc} />}
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
    <div className="space-y-2 max-w-[720px]">
      {visits.map((v) => (
        <Link key={v.id} href={`/admin/bookings/${v.id}`}
          className="rounded-md border border-border bg-card px-4 py-2.5 flex items-center justify-between hover:border-foreground/30 transition-colors">
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{v.outcomeLabel || v.outcome || v.therapyLabel || v.therapy || 'Session'}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5 font-mono">
              {v.ref} · {v.startAt ? new Date(v.startAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-[12.5px] font-medium">₹{Number(v.total || 0).toLocaleString('en-IN')}</div>
            <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">{(v.status || '').replace(/_/g, ' ')}</span>
          </div>
        </Link>
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
  const balanceInr = Number(data?.balanceInr ?? 0);
  const redeemRate = Number(data?.redeemRate ?? 1);
  const rows = Array.isArray(data?.history) ? data.history : [];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Wallet balance</div>
          <div className="mt-1 font-serif text-4xl">₹{balanceInr.toLocaleString('en-IN')}</div>
          <div className="text-[11.5px] text-muted-foreground mt-1">₹{data?.earnInr ?? 500} auto-credited on bookings of ₹{(data?.thresholdInr ?? 3000).toLocaleString('en-IN')}+ ({data?.expiryDays ?? 45}-day validity). Every transaction below is immutable — records are never edited or deleted.</div>
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
                <th className="text-right px-3 py-2 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => {
                // Points are the stored unit; convert to the actual redeemable
                // rupee value for display (was previously showing raw points —
                // or, for booking_earn, the amount *spent* — with a ₹ sign,
                // overstating the real value by 1/redeemRate).
                const isCredit = Number(tx.points) >= 0;
                const amountInrDisplay = Math.floor(Math.abs(Number(tx.points || 0)) * redeemRate);
                const balanceInrDisplay = Math.floor(Number(tx.balanceAfter || 0) * redeemRate);
                return (
                  <tr key={tx.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(tx.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2"><span className="capitalize text-[11.5px] font-medium">{String(tx.type || '').replace(/_/g, ' ')}</span></td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={tx.note}>{tx.note || '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>{isCredit ? '+' : '−'}₹{amountInrDisplay.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">₹{balanceInrDisplay.toLocaleString('en-IN')}</td>
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

/* ================================================================
 * MembershipsTab — full admin CRUD on a customer's subscriptions.
 *   · Freeze / Unfreeze  · Extend (days)  · Adjust sessions/wallet
 *   · Cancel             · Mark paid      · Grant new plan
 * All endpoints already exist under /api/admin/memberships/subs/*.
 * ================================================================ */
function MembershipsTab({ subs = [], customerId, qc }) {
  const [granting, setGranting] = useState(false);
  const plans = useQuery({ queryKey: ['admin-membership-plans'], queryFn: async () => (await fetch('/api/admin/memberships')).json() });
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Memberships</div>
          <div className="text-[12.5px] text-muted-foreground">{subs.length} subscription{subs.length === 1 ? '' : 's'} on record</div>
        </div>
        <button onClick={() => setGranting(true)}
          className="h-8 px-3 rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-foreground/90">
          <Plus className="h-3.5 w-3.5" /> Grant new membership
        </button>
      </div>
      {subs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-[12.5px] text-muted-foreground">
          No membership on this customer yet. Grant one to begin holding sessions on their record.
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => <SubscriptionRow key={s.id} sub={s} customerId={customerId} qc={qc} />)}
        </div>
      )}
      {granting && (
        <GrantMembershipModal
          customerId={customerId}
          plans={plans.data || []}
          onClose={() => setGranting(false)}
          onGranted={() => { setGranting(false); qc.invalidateQueries({ queryKey: ['admin-customer', customerId] }); }}
        />
      )}
    </div>
  );
}

function SubscriptionRow({ sub, customerId, qc }) {
  const [busy, setBusy] = useState(null);
  const plan = sub.planSnapshot || {};
  const badgeCls =
    sub.status === 'active'          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  : sub.status === 'frozen'          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  : sub.status === 'pending_payment' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  : 'bg-muted text-muted-foreground';

  const call = async (action, body = {}) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/memberships/subs/${sub.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success(`Membership ${action.replace('-', ' ')}\u2019d.`);
      qc.invalidateQueries({ queryKey: ['admin-customer', customerId] });
    } catch (e) {
      toast.error(`Could not ${action}: ${e.message || 'error'}`);
    } finally { setBusy(null); }
  };

  const daysLeft = Math.max(0, Math.ceil((new Date(sub.endAt) - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold truncate">{sub.planName || plan.name || 'Membership'}</div>
            <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-[0.12em]', badgeCls)}>
              {sub.status === 'pending_payment' ? 'Payment pending' : sub.status}
            </span>
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-1">
            {plan.type === 'sessions' && <>{sub.sessionsRemaining || 0} of {sub.sessionsIncluded || 0} sessions &middot; </>}
            Started {new Date(sub.startAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {' \u00b7 '}
            ends {new Date(sub.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {sub.status === 'active' && <> ({daysLeft} days)</>}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
        {sub.status === 'active' && (
          <ActionBtn icon={Snowflake} label="Freeze" busy={busy === 'freeze'}
            onClick={() => { const r = prompt('Reason (optional):') || ''; call('freeze', { reason: r }); }} />
        )}
        {sub.status === 'frozen' && (
          <ActionBtn icon={Play} label="Unfreeze" busy={busy === 'unfreeze'}
            onClick={() => call('unfreeze')} tone="brand" />
        )}
        {sub.status === 'pending_payment' && (
          <ActionBtn icon={CreditCard} label="Mark paid" busy={busy === 'mark-paid'}
            onClick={() => { const r = prompt('Payment reference (razorpay id / receipt no):') || ''; call('mark-paid', { paymentRef: r, method: 'offline' }); }} tone="brand" />
        )}
        {(sub.status === 'active' || sub.status === 'frozen') && (
          <>
            <ActionBtn icon={CalendarPlus} label="Extend" busy={busy === 'extend'}
              onClick={() => { const d = Number(prompt('Extend by how many days?', '30')); if (d > 0) call('extend', { days: d, note: 'admin extension' }); }} />
            <ActionBtn icon={Sliders} label="Adjust" busy={busy === 'adjust'}
              onClick={() => {
                const sd = Number(prompt('Adjust sessions by (positive to add, negative to remove):', '0'));
                const wd = Number(prompt('Adjust wallet balance by (INR):', '0'));
                if (sd || wd) call('adjust', { sessionsDelta: sd || 0, walletDelta: wd || 0, note: 'admin adjustment' });
              }} />
            <ActionBtn icon={X} label="Cancel" busy={busy === 'cancel'} tone="danger"
              onClick={() => { if (!confirm('Cancel this membership? This cannot be undone.')) return; const r = prompt('Reason:') || 'admin cancellation'; call('cancel', { reason: r }); }} />
          </>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, busy, onClick, tone = 'default' }) {
  const cls =
    tone === 'brand'   ? 'border-brand bg-brand text-white hover:bg-brand/90' :
    tone === 'danger'  ? 'border-red-500/60 text-red-700 dark:text-red-400 hover:bg-red-500/10' :
                          'border-border hover:bg-muted';
  return (
    <button onClick={onClick} disabled={busy}
      className={cn('h-8 px-2.5 rounded-md border text-[11.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60', cls)}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

function GrantMembershipModal({ customerId, plans, onClose, onGranted }) {
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState('offline'); // offline, complimentary, online
  const [paymentRef, setPaymentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = plans.find((p) => p.id === planId);

  const submit = async (e) => {
    e.preventDefault();
    if (!planId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/memberships/subs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, membershipId: planId, paymentMethod: method, paymentRef: paymentRef || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success(`Granted ${chosen?.name || 'membership'}.`);
      onGranted();
    } catch (e) {
      toast.error('Could not grant: ' + (e.message || 'error'));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-border p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-serif text-[20px] leading-tight">Grant new membership</div>
            <div className="text-[11.5px] text-muted-foreground mt-1">Add a plan directly to this customer&rsquo;s record.</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} required
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-[13px]">
              <option value="">Choose a plan\u2026</option>
              {plans.filter((p) => p.active !== false).map((p) => (
                <option key={p.id} value={p.id}>{p.name} \u2014 &#8377;{Number(p.price || 0).toLocaleString('en-IN')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Payment method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-[13px]">
              <option value="offline">Offline (cash / UPI at reception)</option>
              <option value="online">Online (Razorpay reference)</option>
              <option value="complimentary">Complimentary</option>
            </select>
          </div>
          {(method === 'online' || method === 'offline') && (
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Payment reference (optional)</label>
              <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. razorpay_payment_id / receipt no"
                className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-[13px]" />
            </div>
          )}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="h-9 px-3 rounded-md border border-border text-[12.5px]">Cancel</button>
            <button type="submit" disabled={!planId || busy}
              className="h-9 px-3.5 rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Grant plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

