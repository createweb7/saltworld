'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, LogIn, Play, Square, XCircle, UserX, Loader2, Users, Calendar, PauseCircle, Wallet, CalendarPlus, X } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { cn } from '@/components/ss/utils';
import RescheduleDialog from '@/components/booking/RescheduleDialog';
import { heldStatus, refundableInr, sessionValues } from '@/lib/held-sessions';

async function fetchBooking(id) {
  const res = await fetch(`/api/admin/bookings/${id}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

const ACTIONS = [
  { key: 'check-in', label: 'Check in',    icon: LogIn,   status: 'checked_in' },
  { key: 'start',    label: 'Start',       icon: Play,    status: 'in_session' },
  { key: 'complete', label: 'Complete',    icon: Check,   status: 'completed' },
  { key: 'no-show',  label: 'No-show',     icon: UserX,   status: 'no_show'   },
  { key: 'cancel',   label: 'Cancel',      icon: XCircle, status: 'cancelled' },
];

export default function BookingDetailClient({ user, id }) {
  const qc = useQueryClient();
  const { data: b, isLoading } = useQuery({ queryKey: ['booking', id], queryFn: () => fetchBooking(id) });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['booking', id] });

  const doAction = async (key) => {
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/${key}`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      toast.success(`Marked ${key.replace('-', ' ')}`);
      qc.invalidateQueries({ queryKey: ['booking', id] });
    } catch { toast.error('Could not update'); }
  };

  return (
    <AdminShell user={user} title={b ? `Booking ${b.ref}` : 'Booking'}
      actions={<Link href="/admin/bookings" className="h-8 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-muted"><ArrowLeft className="h-3 w-3" /> Bookings</Link>}
    >
      {isLoading && <div className="text-center py-16"><Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" /></div>}
      {b && (
        <>
          <PageHeader eyebrow="Booking" title={b.ref} subtitle={`${b.contact?.name || 'Guest'} · ${b.slotDate} · ${b.slotTime}`} />
          <AdminSection>
            {b.carriedOverFrom && (
              <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-[12.5px]">
                Prepaid sessions carried over from{' '}
                <Link href={`/admin/bookings/${b.carriedOverFrom.bookingId}`} className="font-mono font-semibold underline underline-offset-2">{b.carriedOverFrom.ref}</Link>
                {' '}&mdash; nothing to collect.
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-4">
              <Card label="Customer" items={[
                ['Name',  b.contact?.name],
                ['Phone', b.contact?.phone],
                ['Email', b.contact?.email],
              ]} />
              <Card label="Session" items={[
                ['Outcome', b.outcome],
                ['Therapy', b.therapy],
                ['Mode',    b.sessionMode === 'couple' ? 'Couple' : b.sessionMode === 'single' ? 'Solo' : '—'],
                ['Guests',  b.guests || 1],
                ...(b.children > 0 ? [['Children', b.children]] : []),
                ['Notes',   b.contact?.notes || '—'],
              ]} />
              <Card label="Payment" items={[
                ['Method', b.payment === 'carried-over' ? 'Prepaid (carried over)' : typeof b.payment === 'string' ? b.payment : b.payment?.method || '—'],
                ['Total',  b.total ? '₹' + b.total.toLocaleString('en-IN') : '—'],
                ['Status', b.status],
              ]} />
            </div>

            <div className="mt-6">
              <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Actions</div>
              <div className="flex flex-wrap gap-2">
                {!['cancelled', 'completed', 'no_show'].includes(b.status) && (
                  <button onClick={() => setRescheduleOpen(true)}
                    className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
                    <Calendar className="h-3.5 w-3.5" /> Reschedule
                  </button>
                )}
                {!['cancelled', 'no_show'].includes(b.status) && (b.therapies || []).length > 1 && (
                  <button onClick={() => setHoldOpen(true)}
                    className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
                    <PauseCircle className="h-3.5 w-3.5" /> Hold unused sessions
                  </button>
                )}
                {ACTIONS.map((a) => (
                  <button key={a.key} onClick={() => doAction(a.key)}
                    className={cn(
                      'h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors',
                      b.status === a.status && 'bg-muted text-muted-foreground pointer-events-none'
                    )}>
                    <a.icon className="h-3.5 w-3.5" /> {a.label}
                  </button>
                ))}
              </div>
            </div>

            <SessionsList booking={b} />
            {(b.heldSessions || []).length > 0 && <HeldSessions booking={b} onChanged={refresh} />}

            {!['cancelled', 'completed', 'no_show'].includes(b.status) && b.sessionMode !== 'couple' && (
              <ConvertToCoupleAdmin booking={b} onConverted={() => qc.invalidateQueries({ queryKey: ['booking', id] })} />
            )}
          </AdminSection>

          {holdOpen && <HoldDialog booking={b} onClose={() => setHoldOpen(false)} onDone={() => { setHoldOpen(false); refresh(); }} />}
          {rescheduleOpen && (
            <RescheduleDialog
              booking={b}
              basePath={`/api/admin/bookings/${b.id}`}
              onClose={() => setRescheduleOpen(false)}
              onSaved={() => {
                setRescheduleOpen(false);
                toast.success('Booking rescheduled');
                qc.invalidateQueries({ queryKey: ['booking', id] });
              }}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

// Staff-side Solo -> Couple conversion — same date/time, price difference
// charged online (same quote/order/verify flow as the customer's account
// page; only the auth + endpoint prefix differ). Renders nothing when the
// booking isn't actually eligible (no session-mode-priced therapy, already
// Couple, or membership-covered).
function ConvertToCoupleAdmin({ booking, onConverted }) {
  const [quote, setQuote]   = useState(undefined); // undefined = loading
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let ok = true;
    fetch(`/api/admin/bookings/${booking.id}/session-mode-quote`)
      .then((r) => r.json())
      .then((d) => { if (ok) setQuote(d); })
      .catch(() => { if (ok) setQuote({ eligible: false }); });
    return () => { ok = false; };
  }, [booking.id]);

  const pay = async () => {
    setPaying(true);
    try {
      const orderRes = await fetch(`/api/admin/bookings/${booking.id}/session-mode/order`, { method: 'POST' });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson.error || 'order_failed');
      if (typeof window.Razorpay !== 'function') throw new Error('checkout_not_ready');

      const rzp = new window.Razorpay({
        key: orderJson.keyId,
        amount: orderJson.order.amount,
        currency: orderJson.order.currency,
        order_id: orderJson.order.id,
        name: 'Salt World',
        description: `Convert ${booking.ref} to Couple`,
        prefill: { name: booking.contact?.name || '', email: booking.contact?.email || '', contact: booking.contact?.phone || '' },
        theme: { color: '#0f4c3a' },
        handler: async (response) => {
          try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/session-mode/verify`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'verify_failed');
            toast.success('Converted to Couple');
            onConverted();
          } catch (e) {
            toast.error(e.message === 'conversion_failed_after_payment'
              ? 'Paid, but this slot can no longer run as Couple (e.g. no couple tank free). Resolve manually — payment is on file.'
              : 'Payment succeeded but activation failed — resolve manually with the payment ID.');
          } finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', () => { toast.error('Payment failed.'); setPaying(false); });
      rzp.open();
    } catch (e) {
      toast.error('Could not start payment.');
      setPaying(false);
    }
  };

  if (!quote?.eligible) return null;

  return (
    <div className="mt-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Convert to Couple</div>
      <button onClick={pay} disabled={paying}
        className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-40">
        {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
        {paying ? 'Processing…' : `Collect +₹${quote.diffInr.toLocaleString('en-IN')} & convert`}
      </button>
      <div className="mt-1.5 text-[11px] text-muted-foreground">Opens Razorpay Checkout for the price difference — same date & time.</div>
    </div>
  );
}

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const istTime = (iso) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(11, 16);
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// The sessions still on this booking, with their times.
function SessionsList({ booking: b }) {
  const items = b.therapies || [];
  if (!items.length) return null;
  return (
    <div className="mt-6">
      <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Sessions</div>
      <div className="rounded-lg border border-border divide-y divide-border">
        {items.map((t) => {
          const legs = (b.schedule || []).filter((s) => s.therapySlug === t.slug);
          return (
            <div key={t.slug} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <span className="font-medium">{t.label || t.slug}</span>
              <span className="font-mono text-[12px] text-muted-foreground">
                {legs[0] ? `${istTime(legs[0].from)} – ${istTime(legs[0].to)}` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Guest leaves part of the package for another day: pick the sessions they
// didn't take. Their rooms are freed; they can be rebooked or refunded later.
function HoldDialog({ booking: b, onClose, onDone }) {
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const therapies = b.therapies || [];
  const values = sessionValues(b, therapies.map((t) => t.slug));
  const toggle = (slug) => setSel((cur) => (cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug]));
  const tooMany = sel.length >= therapies.length;
  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/hold`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs: sel }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || 'failed');
      toast.success(`${sel.length} session${sel.length === 1 ? '' : 's'} held`);
      onDone();
    } catch (e) { toast.error(String(e.message)); setBusy(false); }
  };
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Hold unused sessions</div>
          <h2 className="mt-1 font-serif text-2xl">Which sessions weren&rsquo;t taken?</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full hover:bg-muted inline-flex items-center justify-center"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground leading-[1.5]">
        The rooms for these sessions are freed now. They stay prepaid on this booking and can be rebooked on any date until {fmtDay(new Date(new Date(b.createdAt).setFullYear(new Date(b.createdAt).getFullYear() + 1)))}, or refunded to the wallet.
      </p>
      <div className="mt-4 rounded-lg border border-border divide-y divide-border">
        {therapies.map((t) => (
          <label key={t.slug} className="flex items-center gap-3 px-4 py-2.5 text-[13px] cursor-pointer">
            <input type="checkbox" checked={sel.includes(t.slug)} onChange={() => toggle(t.slug)} className="h-4 w-4" />
            <span className="flex-1 font-medium">{t.label || t.slug}</span>
            <span className="font-mono text-[12px] text-muted-foreground">{inr(values[t.slug])}</span>
          </label>
        ))}
      </div>
      {tooMany && <div className="mt-2 text-[12px] text-red-600">Keep at least one session &mdash; to move the whole booking, use Reschedule.</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Cancel</button>
        <button onClick={save} disabled={busy || !sel.length || tooMany} className="h-9 px-3 rounded-md text-[12.5px] font-semibold bg-foreground text-background disabled:opacity-40">
          {busy ? 'Saving…' : `Hold ${sel.length || ''} session${sel.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Overlay>
  );
}

const HELD_PILL = {
  held:      ['Held', 'bg-amber-500/10 text-amber-700 dark:text-amber-400'],
  rebooked:  ['Rebooked', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  refunded:  ['Refunded', 'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
  expired:   ['Expired', 'bg-red-500/10 text-red-600 dark:text-red-400'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground'],
};

// Held sessions on this booking: rebook any of them on a new date (no
// charge), or refund them to the guest's wallet in special cases.
function HeldSessions({ booking: b, onChanged }) {
  const [sel, setSel] = useState([]);
  const [rebookOpen, setRebookOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const sessions = b.heldSessions || [];
  const open = sessions.filter((h) => heldStatus(h) === 'held');
  const picked = open.filter((h) => sel.includes(h.id));
  const toggle = (hid) => setSel((cur) => (cur.includes(hid) ? cur.filter((x) => x !== hid) : [...cur, hid]));
  const done = () => { setSel([]); setRebookOpen(false); setRefundOpen(false); onChanged(); };
  return (
    <div className="mt-6">
      <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Held sessions</div>
      <div className="rounded-lg border border-border divide-y divide-border">
        {sessions.map((h) => {
          const st = heldStatus(h);
          const [label, cls] = HELD_PILL[st] || HELD_PILL.held;
          return (
            <label key={h.id} className={cn('flex items-center gap-3 px-4 py-2.5 text-[13px]', st === 'held' && 'cursor-pointer')}>
              <input type="checkbox" disabled={st !== 'held'} checked={sel.includes(h.id)} onChange={() => toggle(h.id)} className="h-4 w-4 disabled:opacity-30" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">{h.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {st === 'held' && `Valid until ${fmtDay(h.expiresAt)}`}
                  {st === 'expired' && `Expired ${fmtDay(h.expiresAt)}`}
                  {st === 'rebooked' && <>Booked as <Link href={`/admin/bookings/${h.rebookedBookingId}`} className="font-mono underline underline-offset-2">{h.rebookedRef}</Link></>}
                  {st === 'refunded' && `${inr(h.refundInr)} added to wallet ${fmtDay(h.refundedAt)}`}
                  {st === 'cancelled' && 'Booking was cancelled'}
                </span>
              </span>
              <span className="font-mono text-[12px] text-muted-foreground">{inr(h.valueInr)}</span>
              <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold', cls)}>{label}</span>
            </label>
          );
        })}
      </div>
      {open.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setRebookOpen(true)} disabled={!picked.length}
            className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-40">
            <CalendarPlus className="h-3.5 w-3.5" /> Rebook selected
          </button>
          <button onClick={() => setRefundOpen(true)} disabled={!picked.length}
            className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-40">
            <Wallet className="h-3.5 w-3.5" /> Refund to wallet
          </button>
          <span className="text-[11.5px] text-muted-foreground">{picked.length ? `${picked.length} selected` : 'Tick the sessions to rebook or refund. Rebook them together or on different days.'}</span>
        </div>
      )}
      {rebookOpen && (
        <RescheduleDialog
          booking={{ therapies: picked.map((h) => ({ slug: h.slug, label: h.label, durationMin: h.durationMin })), sessionMode: b.sessionMode, guests: b.guests, children: b.children, startAt: b.startAt }}
          submitUrl={`/api/admin/bookings/${b.id}/held/rebook`}
          extraBody={{ sessionIds: picked.map((h) => h.id) }}
          maxDate={picked.map((h) => h.expiresAt.slice(0, 10)).sort()[0]}
          eyebrow="Rebook held sessions" title={picked.map((h) => h.label).join(' + ')} confirmVerb="Book" keepLabel="Cancel"
          onClose={() => setRebookOpen(false)}
          onSaved={(j) => { toast.success(`Booked as ${j?.rebooked?.ref || 'a new booking'} — confirmation sent`); done(); }}
        />
      )}
      {refundOpen && <RefundDialog booking={b} sessions={picked} onClose={() => setRefundOpen(false)} onDone={done} />}
    </div>
  );
}

function RefundDialog({ booking: b, sessions, onClose, onDone }) {
  const max = refundableInr(b);
  const suggested = Math.min(max, sessions.reduce((s, h) => s + (Number(h.valueInr) || 0), 0));
  const [amount, setAmount] = useState(String(suggested));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Math.round(Number(amount));
  const bad = !(n > 0) || n > max;
  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/held/refund`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: sessions.map((h) => h.id), amountInr: n, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || 'failed');
      toast.success(`${inr(n)} added to the guest's wallet`);
      onDone();
    } catch (e) { toast.error(String(e.message)); setBusy(false); }
  };
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Refund to wallet</div>
          <h2 className="mt-1 font-serif text-2xl">{sessions.map((h) => h.label).join(' + ')}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full hover:bg-muted inline-flex items-center justify-center"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground leading-[1.5]">
        For special cases. The amount goes to {b.contact?.name || 'the guest'}&rsquo;s Salt World wallet, and these sessions can no longer be rebooked.
      </p>
      <label className="mt-4 block text-[12px] font-medium" htmlFor="heldRefundAmount">Amount (₹)</label>
      <input id="heldRefundAmount" type="number" min="1" max={max} value={amount} onChange={(e) => setAmount(e.target.value)}
        className="mt-1 h-10 w-40 rounded-md border border-border bg-background px-3 font-mono text-[14px]" />
      <div className="mt-1 text-[11.5px] text-muted-foreground">Suggested {inr(suggested)} (their share of the package price). Up to {inr(max)}.</div>
      <label className="mt-4 block text-[12px] font-medium" htmlFor="heldRefundNote">Reason (optional)</label>
      <input id="heldRefundNote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. medical reason"
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-[13px]" />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Cancel</button>
        <button onClick={save} disabled={busy || bad} className="h-9 px-3 rounded-md text-[12.5px] font-semibold bg-foreground text-background disabled:opacity-40">
          {busy ? 'Saving…' : `Refund ${bad ? '' : inr(n)}`}
        </button>
      </div>
    </Overlay>
  );
}

function Card({ label, items }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{label}</div>
      <dl className="mt-3 space-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-start gap-3 text-[13px]">
            <dt className="w-20 text-muted-foreground">{k}</dt>
            <dd className="flex-1 min-w-0 font-medium">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
