'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Gift, Search, X } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';
import { GIFT_DESIGNS, DENOMINATIONS } from '@/lib/gift-designs';
import GiftCardPreview from '@/components/site/gift-card-preview';

async function fetchGifts(status) {
  const url = status ? `/api/admin/giftcards?status=${status}` : '/api/admin/giftcards';
  const res = await fetch(url);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

async function fetchGiftByCode(code) {
  const res = await fetch(`/api/admin/giftcards/by-code/${encodeURIComponent(code.trim().toUpperCase())}`);
  if (!res.ok) return null;
  return res.json();
}

export default function GiftcardsClient({ user }) {
  const [tab, setTab] = useState('active');
  const [newOpen, setNewOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(null);
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null); // { found: bool, gift? }
  const [searching, setSearching] = useState(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['giftcards', tab], queryFn: () => fetchGifts(tab) });

  const runSearch = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setSearching(true);
    try {
      const gift = await fetchGiftByCode(searchCode);
      setSearchResult(gift ? { found: true, gift } : { found: false });
    } finally { setSearching(false); }
  };

  const columns = [
    { key: 'code',   label: 'Code',   render: (r) => <span className="font-mono text-[12.5px]">{r.code}</span> },
    { key: 'amount', label: 'Value',  render: (r) => inr(r.amount) },
    { key: 'balance',label: 'Balance',render: (r) => inr(r.balance) },
    { key: 'to',     label: 'Recipient', render: (r) => <div><div className="text-[12.5px]">{r.to?.name || '—'}</div><div className="text-[11px] text-muted-foreground">{r.to?.email || r.to?.phone || ''}</div></div> },
    { key: 'designId', label: 'Design', render: (r) => <span className="text-[11.5px] text-muted-foreground capitalize">{r.designId}</span> },
    { key: 'createdAt', label: 'Issued', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', render: (r) => (
      r.status === 'active' && <button onClick={(e) => { e.stopPropagation(); setRedeeming(r); }}
        className="h-7 px-3 rounded-md border border-border text-[11.5px] font-medium hover:bg-muted">Redeem</button>
    )},
  ];

  return (
    <AdminShell user={user} title="Gift cards" actions={
      <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> Issue gift card</PrimaryBtn>
    }>
      <PageHeader eyebrow="Sell" title="Gift cards" subtitle="Issue, redeem and track gift cards. Valid for 12 months from issue." />
      <AdminSection>
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Look up a gift card</div>
          <form onSubmit={runSearch} className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={searchCode} onChange={(e) => { setSearchCode(e.target.value.toUpperCase()); setSearchResult(null); }}
                placeholder="Customer's code, e.g. SW-AB12-CD34"
                className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-[12.5px] font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <PrimaryBtn type="submit" className="h-9 px-4" disabled={searching || !searchCode.trim()}>{searching ? 'Searching…' : 'Search'}</PrimaryBtn>
          </form>

          {searchResult && (
            <div className="mt-3 max-w-md">
              {searchResult.found ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="scale-90 origin-top-left -m-2">
                      <GiftCardPreview designId={searchResult.gift.designId} amount={searchResult.gift.amount || searchResult.gift.balance}
                        experienceTitle={searchResult.gift.kind === 'experience' ? searchResult.gift.outcomeTitle : ''}
                        code={searchResult.gift.code} to={searchResult.gift.to?.name} from={searchResult.gift.from?.name} size="sm" />
                    </div>
                    <button onClick={() => { setSearchResult(null); setSearchCode(''); }} className="h-7 w-7 rounded-md hover:bg-muted inline-flex items-center justify-center shrink-0"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-2 space-y-1 text-[12.5px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize">{searchResult.gift.status}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className="font-medium">{inr(searchResult.gift.balance)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PIN</span><span className="font-mono">{searchResult.gift.pin || '—'}</span></div>
                  </div>
                  {searchResult.gift.status === 'active' && (
                    <button onClick={() => setRedeeming(searchResult.gift)} className="mt-3 h-8 px-3 rounded-md border border-border text-[12px] font-medium hover:bg-muted">Redeem</button>
                  )}
                </div>
              ) : (
                <div className="text-[12.5px] text-muted-foreground">No gift card matches that code.</div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <Tabs items={[
            { key: 'active',   label: 'Active'   },
            { key: 'redeemed', label: 'Redeemed' },
            { key: 'expired',  label: 'Expired'  },
            { key: '',         label: 'All'      },
          ]} active={tab} onChange={setTab} />
        </div>
        <SimpleTable columns={columns} rows={data} isLoading={isLoading} empty="No gift cards here yet." />
      </AdminSection>

      {newOpen && <IssueGiftCard onClose={() => setNewOpen(false)} onIssued={() => { qc.invalidateQueries({ queryKey: ['giftcards'] }); setNewOpen(false); }} />}
      {redeeming && <RedeemGiftCard gift={redeeming} onClose={() => setRedeeming(null)} onRedeemed={() => { qc.invalidateQueries({ queryKey: ['giftcards'] }); setRedeeming(null); }} />}
    </AdminShell>
  );
}

function IssueGiftCard({ onClose, onIssued }) {
  const [form, setForm] = useState({
    designId: 'halite', amount: 5000,
    fromName: '', fromEmail: '',
    toName: '', toEmail: '', toPhone: '',
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const issue = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/giftcards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: form.designId, amount: Number(form.amount),
          from: { name: form.fromName, email: form.fromEmail },
          to:   { name: form.toName, email: form.toEmail, phone: form.toPhone },
          message: form.message,
        }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      toast.success(`Issued ${data.code}`);
      onIssued();
    } catch { toast.error('Could not issue'); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open onClose={onClose} eyebrow="Gift card" title="Issue new gift card"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={issue} disabled={saving || form.amount < 100}>{saving ? 'Issuing…' : 'Issue gift card'}</PrimaryBtn></div>}
    >
      <div className="space-y-4">
        {/* Preview */}
        <div className="flex justify-center">
          <GiftCardPreview designId={form.designId} amount={Number(form.amount) || 0} from={form.fromName} to={form.toName} message={form.message} occasion="Gift" size="sm" />
        </div>

        <Field label="Design">
          <div className="flex flex-wrap gap-2">
            {GIFT_DESIGNS.map((d) => (
              <button key={d.id} type="button" onClick={() => setForm({ ...form, designId: d.id })}
                className={`h-8 px-3 rounded-full border text-[12px] font-medium transition-colors ${form.designId === d.id ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground hover:bg-muted'}`}>
                {d.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Amount (₹)" required>
          <Input type="number" min={100} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DENOMINATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setForm({ ...form, amount: d })}
                className="h-7 px-2.5 rounded-full border border-border text-[11.5px] text-muted-foreground hover:bg-muted">{inr(d)}</button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From (name)"><Input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} /></Field>
          <Field label="From (email)"><Input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} /></Field>
        </div>
        <Field label="To (name)"><Input value={form.toName} onChange={(e) => setForm({ ...form, toName: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="To (email)"><Input type="email" value={form.toEmail} onChange={(e) => setForm({ ...form, toEmail: e.target.value })} /></Field>
          <Field label="To (phone)"><Input value={form.toPhone} onChange={(e) => setForm({ ...form, toPhone: e.target.value })} /></Field>
        </div>
        <Field label="Message"><Textarea rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}

function RedeemGiftCard({ gift, onClose, onRedeemed }) {
  const [amount, setAmount] = useState(gift.balance);
  const [saving, setSaving] = useState(false);
  const redeem = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/giftcards/${gift.id}/redeem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Redeemed');
      onRedeemed();
    } catch { toast.error('Could not redeem'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow={gift.code} title="Redeem gift card"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={redeem} disabled={saving || Number(amount) <= 0}>{saving ? 'Redeeming…' : `Redeem ${inr(amount)}`}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Balance available</div>
          <div className="mt-1 font-serif text-[28px] tracking-tight">{inr(gift.balance)}</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">of {inr(gift.amount)} issued</div>
        </div>
        <Field label="Amount to redeem">
          <Input type="number" min={1} max={gift.balance} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}
