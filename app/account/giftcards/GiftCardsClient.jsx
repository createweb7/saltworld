'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Gift, Plus, KeyRound, Sparkles } from 'lucide-react';

export default function GiftCardsClient({ initialCards }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards || []);
  const [claimOpen, setClaimOpen] = useState(false);
  const [code, setCode] = useState('');
  const [pin, setPin]   = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  const submit = async () => {
    if (!code || !pin) return setErr('Please enter both code and PIN.');
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/customer/giftcards/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, pin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(readableError(j.error));
      setCards([j.giftcard, ...cards]);
      setClaimOpen(false); setCode(''); setPin('');
      toast.success('Gift card claimed – it’s yours now!');
      router.refresh();
    } catch (e) { setErr(String(e.message || 'Could not claim')); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={() => setClaimOpen(true)}
        className="mb-6 h-11 px-5 rounded-full bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-2">
        <Plus className="h-4 w-4" /> Claim a new gift card
      </button>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Gift className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-serif text-2xl">No gift cards yet</h3>
          <p className="mt-1 text-[13px] text-muted-foreground max-w-sm mx-auto">If someone gifted you a Salt World card, tap the button above and enter the code + PIN to claim it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((gc) => <GiftCardTile key={gc.id} gc={gc} />)}
        </div>
      )}

      {claimOpen && (
        <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Claim</div>
            <h2 className="mt-1 font-serif text-2xl">Add a gift card</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Enter the code and PIN from the email or physical card.</p>
            <div className="mt-5 space-y-3">
              <label className="block">
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Gift card code</div>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SW-XXXX-XXXX"
                  className="mt-1 w-full h-11 rounded-md border border-border bg-background font-mono text-[15px] tracking-widest px-3 focus:outline-none focus:ring-2 focus:ring-brand/40" />
              </label>
              <label className="block">
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold flex items-center gap-1"><KeyRound className="h-3 w-3" />6-digit PIN</div>
                <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" maxLength={6}
                  className="mt-1 w-full h-11 rounded-md border border-border bg-background font-mono text-[15px] tracking-[0.2em] px-3 focus:outline-none focus:ring-2 focus:ring-brand/40" />
              </label>
              {err && <div className="text-[12.5px] text-red-600">{err}</div>}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setClaimOpen(false)} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Cancel</button>
              <button onClick={submit} disabled={busy || !code || !pin}
                className="h-9 px-4 rounded-md text-[12.5px] font-semibold bg-foreground text-background disabled:opacity-40 hover:bg-foreground/90 inline-flex items-center gap-1.5">
                {busy ? 'Claiming…' : <><Sparkles className="h-3.5 w-3.5" />Claim card</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GiftCardTile({ gc }) {
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const isRedeemed = gc.status === 'redeemed' || Number(gc.balance) === 0;
  const design = gc.designId || 'halite';
  const bg = {
    halite:   'bg-gradient-to-br from-[#0f2038] via-[#153059] to-[#1e478c] text-white',
    aurora:   'bg-gradient-to-br from-[#4c1d95] via-[#7c3aed] to-[#ec4899] text-white',
    forest:   'bg-gradient-to-br from-[#0f4229] via-[#166534] to-[#22c55e] text-white',
    dune:     'bg-gradient-to-br from-[#78350f] via-[#b45309] to-[#f59e0b] text-white',
    ocean:    'bg-gradient-to-br from-[#083344] via-[#155e75] to-[#06b6d4] text-white',
  }[design] || 'bg-gradient-to-br from-slate-800 to-slate-950 text-white';

  return (
    <div className={`rounded-2xl ${bg} p-5 shadow-lg relative overflow-hidden ${isRedeemed ? 'opacity-70' : ''}`}>
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold opacity-80">Salt World Gift Card</div>
          <Gift className="h-4 w-4 opacity-80" />
        </div>
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Balance</div>
          <div className="mt-0.5 font-serif text-4xl tracking-tight">{fmt(gc.balance)}</div>
          {isRedeemed && <div className="mt-1 text-[11px] uppercase tracking-[0.18em] font-semibold text-red-200">Fully redeemed</div>}
        </div>
        <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[11px]">
          <div>
            <div className="opacity-70">Code</div>
            <div className="font-mono font-semibold tracking-widest text-[12.5px]">{gc.code}</div>
          </div>
          <div className="text-right">
            <div className="opacity-70">Amount</div>
            <div className="font-mono font-semibold">{fmt(gc.amount)}</div>
          </div>
        </div>
        {gc.from?.name && <div className="mt-3 text-[11px] opacity-80">From <span className="font-medium">{gc.from.name}</span>{gc.message ? ` — “${gc.message}”` : ''}</div>}
        {gc.expiresAt && <div className="mt-2 text-[10.5px] opacity-60">Expires {new Date(gc.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
      </div>
    </div>
  );
}

function readableError(code) {
  switch (code) {
    case 'not_found':       return 'That code doesn’t match any gift card. Check for typos.';
    case 'invalid_pin':     return 'That PIN is incorrect.';
    case 'card_redeemed':   return 'This card has already been fully redeemed.';
    case 'card_cancelled':  return 'This gift card was cancelled by the issuer.';
    case 'expired':         return 'This gift card has expired.';
    case 'already_claimed': return 'This card is already linked to another account.';
    case 'code_and_pin_required': return 'Please enter both code and PIN.';
    case 'auth_required':   return 'Please sign in first.';
    default:                return 'Could not claim gift card. Please try again.';
  }
}
