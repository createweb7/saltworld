'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Printer, Pencil, Check } from 'lucide-react';
import GiftCardPreview from '@/components/site/gift-card-preview';

export default function GiftCertificateClient({ gift: initial }) {
  const [gift, setGift] = useState(initial);
  const [editing, setEditing] = useState(!gift.to?.name);
  const [toName, setToName] = useState(gift.to?.name || '');
  const [toEmail, setToEmail] = useState(gift.to?.email || '');
  const [toPhone, setToPhone] = useState(gift.to?.phone || '');
  const [saving, setSaving] = useState(false);

  const isPending = gift.status === 'payment_pending';

  const saveRecipient = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/gifts/${gift.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: { name: toName, email: toEmail, phone: toPhone } }),
      });
      if (!res.ok) throw new Error('failed');
      const updated = await res.json();
      setGift(updated);
      setEditing(false);
      toast.success('Recipient updated');
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };

  const therapyLabel = (gift.therapies || []).map((t) => t.name).join(' + ');
  const experienceTitle = gift.kind === 'experience' ? gift.outcomeTitle : '';
  const includesLabel = gift.kind === 'experience' ? `${therapyLabel}${gift.guests > 1 ? ' · Couple' : ''}` : '';

  return (
    <div className="mt-6">
      {isPending ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
          Payment not completed for this gift yet.
        </div>
      ) : (
        <>
          <div id="gift-certificate-print" className="flex justify-center">
            <GiftCardPreview
              designId={gift.designId} amount={gift.amount || gift.balance}
              experienceTitle={experienceTitle} includesLabel={includesLabel}
              from={gift.from?.name} to={gift.to?.name} message={gift.message}
              code={gift.code} occasion={gift.occasion} size="lg"
            />
          </div>

          <div className="no-print mt-6 flex items-center justify-center gap-2">
            <button onClick={() => window.print()} className="h-10 px-4 rounded-full border border-border text-[13px] font-medium hover:bg-muted inline-flex items-center gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print or save as PDF
            </button>
          </div>

          <div className="no-print mt-8 rounded-2xl border border-border bg-card p-5 space-y-3 text-[13px]">
            <Row label="PIN" value={gift.pin} mono />
            <Row label="Status" value={gift.status === 'active' ? 'Active' : gift.status} />
            <Row label="Valid until" value={gift.expiresAt ? new Date(gift.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
          </div>

          <div className="no-print mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Recipient</div>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-3 space-y-2">
                <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Their name" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="Email" className="h-10 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
                  <input value={toPhone} onChange={(e) => setToPhone(e.target.value)} placeholder="Phone" className="h-10 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <button onClick={saveRecipient} disabled={saving} className="h-9 px-4 rounded-full bg-foreground text-background text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? 'Saving…' : <><Check className="h-3.5 w-3.5" /> Save</>}
                </button>
              </div>
            ) : (
              <div className="mt-2 text-[13.5px]">{gift.to?.name}{gift.to?.email ? ` · ${gift.to.email}` : ''}{gift.to?.phone ? ` · ${gift.to.phone}` : ''}</div>
            )}
          </div>

          <p className="no-print mt-4 text-[12px] text-muted-foreground text-center">
            Not decided who this is for yet? That&rsquo;s fine — print or share the code above whenever you&rsquo;re ready, or add their details here later.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}
