'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Undo2, IndianRupee, CreditCard, Smartphone, Banknote, ArrowUpRight } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';

async function fetchPayments() {
  const res = await fetch('/api/admin/payments');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchInvoices() {
  const res = await fetch('/api/admin/invoices');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

const METHODS = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'upi',  label: 'UPI',  icon: Smartphone },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'razorpay', label: 'Razorpay', icon: IndianRupee },
  { key: 'wallet',   label: 'Wallet',   icon: IndianRupee },
];

export default function PaymentsClient({ user }) {
  const [tab, setTab] = useState('payments');
  const [newOpen, setNewOpen] = useState(false);
  const [refunding, setRefunding] = useState(null);
  const qc = useQueryClient();
  const pay = useQuery({ queryKey: ['payments'], queryFn: fetchPayments });
  const inv = useQuery({ queryKey: ['invoices'], queryFn: fetchInvoices });

  const columnsPayments = [
    { key: 'invoiceNumber', label: 'Invoice', render: (r) => <span className="font-mono text-[12.5px]">{r.invoiceNumber || '—'}</span> },
    { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
    { key: 'method', label: 'Method', render: (r) => <span className="capitalize text-[12.5px]">{r.method}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusChip s={r.status} /> },
    { key: 'createdAt', label: 'Collected', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'actions', label: '', render: (r) => (
      r.status === 'succeeded' && <button onClick={(e) => { e.stopPropagation(); setRefunding(r); }} className="h-7 px-3 rounded-md border border-border text-[11.5px] font-medium hover:bg-muted inline-flex items-center gap-1"><Undo2 className="h-3 w-3" /> Refund</button>
    )},
  ];

  const columnsInvoices = [
    { key: 'number', label: 'Number', render: (r) => <span className="font-mono text-[12.5px]">{r.number}</span> },
    { key: 'customerName', label: 'Customer' },
    { key: 'subtotal', label: 'Subtotal', render: (r) => inr(r.subtotal) },
    { key: 'cgst', label: 'CGST 9%', render: (r) => inr(r.cgst) },
    { key: 'sgst', label: 'SGST 9%', render: (r) => inr(r.sgst) },
    { key: 'total', label: 'Total',   render: (r) => <span className="font-semibold">{inr(r.total)}</span> },
    { key: 'createdAt', label: 'Issued', render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <AdminShell user={user} title="Payments" actions={
      <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> Collect payment</PrimaryBtn>
    }>
      <PageHeader eyebrow="Finance" title="Payments" subtitle="Every rupee, every invoice. GST at 18% (CGST 9% + SGST 9%) for intra-Karnataka sales." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={[
            { key: 'payments', label: 'Transactions', count: pay.data?.length },
            { key: 'invoices', label: 'Invoices',     count: inv.data?.length },
          ]} active={tab} onChange={setTab} />
        </div>
        {tab === 'payments' && <SimpleTable columns={columnsPayments} rows={pay.data || []} isLoading={pay.isLoading} empty={"No transactions yet. Use \u2018Collect payment\u2019 to record one."} />}
        {tab === 'invoices' && <SimpleTable columns={columnsInvoices} rows={inv.data || []} isLoading={inv.isLoading} empty="No invoices issued yet." />}
      </AdminSection>

      {newOpen && <CollectPayment onClose={() => setNewOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); setNewOpen(false); }} />}
      {refunding && <RefundDialog payment={refunding} onClose={() => setRefunding(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['payments'] }); setRefunding(null); }} />}
    </AdminShell>
  );
}

function CollectPayment({ onClose, onDone }) {
  const [form, setForm] = useState({
    total: 1499, method: 'cash',
    customerName: 'Guest', customerGstin: '',
    description: 'Session', ref: '',
  });
  const [saving, setSaving] = useState(false);
  const collect = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, total: Number(form.total), gstRate: 18 }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      toast.success(`Payment collected · ${data.invoice.number}`);
      onDone();
    } catch { toast.error('Could not collect'); }
    finally { setSaving(false); }
  };

  const total = Number(form.total) || 0;
  const subtotal = Math.round((total * 100) / 118);
  const tax = total - subtotal;

  return (
    <Drawer open onClose={onClose} eyebrow="POS" title="Collect payment"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={collect} disabled={saving || total <= 0}>{saving ? 'Collecting…' : `Collect ${inr(total)}`}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Customer name"><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Field>
        <Field label="Customer GSTIN (optional)" hint="For B2B invoices"><Input value={form.customerGstin} onChange={(e) => setForm({ ...form, customerGstin: e.target.value })} placeholder="e.g. 29ABLCS6657A1Z0" /></Field>
        <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Total amount (₹) — inclusive of 18% GST" required>
          <Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
        </Field>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-[12.5px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{inr(subtotal)}</span></div>
          <div className="flex justify-between mt-1"><span className="text-muted-foreground">CGST 9%</span><span className="font-medium">{inr(Math.round(tax / 2))}</span></div>
          <div className="flex justify-between mt-1"><span className="text-muted-foreground">SGST 9%</span><span className="font-medium">{inr(tax - Math.round(tax / 2))}</span></div>
          <div className="flex justify-between mt-2 pt-2 border-t border-border font-semibold"><span>Total</span><span>{inr(total)}</span></div>
        </div>

        <Field label="Method">
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button key={m.key} type="button" onClick={() => setForm({ ...form, method: m.key })}
                className={`h-10 rounded-md border text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${form.method === m.key ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground hover:bg-muted'}`}>
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>
        </Field>
        {form.method !== 'cash' && (
          <Field label="Reference / txn id (optional)"><Input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></Field>
        )}
      </div>
    </Drawer>
  );
}

function RefundDialog({ payment, onClose, onDone }) {
  const [amount, setAmount] = useState(payment.amount);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const refund = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), reason }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Refund recorded');
      onDone();
    } catch { toast.error('Refund failed'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow={payment.invoiceNumber || 'Payment'} title="Refund payment"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={refund} disabled={saving || Number(amount) <= 0}>{saving ? 'Refunding…' : `Refund ${inr(amount)}`}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Original payment</div>
          <div className="mt-1 font-serif text-[24px] tracking-tight">{inr(payment.amount)}</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5 capitalize">{payment.method} · {new Date(payment.createdAt).toLocaleString()}</div>
        </div>
        <Field label="Refund amount (₹)"><Input type="number" min={1} max={payment.amount} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reason"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the refund…" /></Field>
      </div>
    </Drawer>
  );
}

function StatusChip({ s }) {
  const map = {
    succeeded: ['Succeeded', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
    pending:   ['Pending',   'bg-amber-500/10 text-amber-700 dark:text-amber-400'],
    refunded:  ['Refunded',  'bg-red-500/10 text-red-700 dark:text-red-400'],
    failed:    ['Failed',    'bg-red-500/10 text-red-700 dark:text-red-400'],
  };
  const [label, cls] = map[s] || ['—', 'bg-muted text-muted-foreground'];
  return <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${cls}`}>{label}</span>;
}
