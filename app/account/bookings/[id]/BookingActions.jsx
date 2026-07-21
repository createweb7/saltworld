'use client';

// Customer-facing Cancel / Reschedule for a single booking.
// Honours the server-side cancel/reschedule cutoff. If past cutoff, buttons
// are visible but disabled with an explanatory tooltip. If reschedule is
// attempted and the target slot is no longer available, we surface the
// server-returned suggestions inline.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X, Calendar, Clock } from 'lucide-react';

const IST_OFFSET_MIN = 330;

function toIsoDay(d) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return shifted.toISOString().slice(0, 10);
}

export default function BookingActions({ booking }) {
  const router = useRouter();
  const [rules, setRules]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen]         = useState(false);

  useEffect(() => {
    let ok = true;
    fetch('/api/booking-rules').then((r) => r.ok ? r.json() : null).then((d) => { if (ok) setRules(d); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  const cutoff = useMemo(() => {
    if (!booking?.startAt || !rules) return null;
    const start = new Date(booking.startAt);
    const istMs = start.getTime() + IST_OFFSET_MIN * 60000;
    const ist = new Date(istMs);
    const [h, m] = String(rules.cutoffTime || '21:00').split(':').map(Number);
    ist.setUTCDate(ist.getUTCDate() - Number(rules.cutoffDaysBefore || 1));
    ist.setUTCHours(h, m, 0, 0);
    return new Date(ist.getTime() - IST_OFFSET_MIN * 60000);
  }, [booking, rules]);

  const isPastCutoff = cutoff ? Date.now() > cutoff.getTime() : false;
  const isTerminal   = ['cancelled', 'completed', 'no_show', 'in_session'].includes(booking.status);
  const disabled     = isPastCutoff || isTerminal;

  const cutoffLabel = cutoff
    ? cutoff.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
    : null;

  if (isTerminal) {
    return (
      <div className="pt-3 border-t border-border text-[11.5px] text-muted-foreground">
        This booking is {booking.status.replace(/_/g, ' ')}.
      </div>
    );
  }

  return (
    <>
      <div className="pt-3 border-t border-border space-y-2">
        <button
          type="button"
          onClick={() => setRescheduleOpen(true)}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-border text-[12.5px] font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5" /> Reschedule
        </button>
        <button
          type="button"
          onClick={() => setCancelOpen(true)}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-transparent text-[12.5px] font-medium text-red-600 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          <X className="h-3.5 w-3.5" /> Cancel booking
        </button>
        {isPastCutoff && cutoffLabel && (
          <div className="text-[11px] text-muted-foreground pt-1 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Changes were allowed until <span className="font-mono">{cutoffLabel}</span>. Please call reception for exceptions.</span>
          </div>
        )}
        {!isPastCutoff && cutoffLabel && (
          <div className="text-[11px] text-muted-foreground pt-1">
            You can change until <span className="font-mono">{cutoffLabel}</span>.
          </div>
        )}
      </div>

      {cancelOpen && (
        <ConfirmCancel
          onClose={() => setCancelOpen(false)}
          onConfirmed={() => { setCancelOpen(false); router.refresh(); }}
          bookingId={booking.id}
        />
      )}
      {rescheduleOpen && (
        <RescheduleDialog
          booking={booking}
          onClose={() => setRescheduleOpen(false)}
          onSaved={() => { setRescheduleOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}

function ConfirmCancel({ bookingId, onClose, onConfirmed }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'cancel_failed');
      onConfirmed();
    } catch (e) { setErr(String(e.message || 'Could not cancel')); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Cancel</div>
        <h2 className="mt-1 font-serif text-2xl">Cancel this booking?</h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
          The slot will be released and offered to other guests. You&rsquo;ll get a confirmation via SMS/WhatsApp.
        </p>
        <label className="block mt-4 text-[12px] font-medium">Reason (optional)</label>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background text-[13px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="Feeling unwell / travel plans / …" />
        {err && <div className="mt-3 text-[12px] text-red-600">{err}</div>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Keep booking</button>
          <button onClick={submit} disabled={busy} className="h-9 px-3 rounded-md text-[12.5px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
            {busy ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleDialog({ booking, onClose, onSaved }) {
  const therapySlugs = (booking.therapies || []).map((t) => t.slug).filter(Boolean);
  const sessionMode  = booking.sessionMode || null;

  const days = useMemo(() => {
    const arr = [];
    const start = new Date(); start.setHours(0,0,0,0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const [date, setDate]         = useState(toIsoDay(new Date()));
  const [slots, setSlots]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [picked, setPicked]     = useState(null);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);
  const [conflictHint, setConflictHint] = useState(null);

  useEffect(() => {
    if (therapySlugs.length === 0 || !date) return;
    let ok = true;
    setLoading(true);
    const q = new URLSearchParams({ therapies: therapySlugs.join(','), date });
    if (sessionMode) q.set('sessionMode', sessionMode);
    fetch(`/api/scheduling/slots?${q}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (ok) { setSlots(d); setLoading(false); } })
      .catch(() => { if (ok) { setSlots(null); setLoading(false); } });
    return () => { ok = false; };
  }, [date, therapySlugs.join(','), sessionMode]);

  const submit = async () => {
    if (!picked) return setErr('Please pick a new time slot.');
    setBusy(true); setErr(null); setConflictHint(null);
    try {
      const r = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: picked.startIso,
          slotDate: date,
          slotTime: picked.time,
          sessionMode,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) {
        setConflictHint('That time slot just got taken. Please pick another below.');
        // Refresh the slots for the same date
        const q = new URLSearchParams({ therapies: therapySlugs.join(','), date });
        if (sessionMode) q.set('sessionMode', sessionMode);
        const fresh = await fetch(`/api/scheduling/slots?${q}`).then((r) => r.ok ? r.json() : null);
        setSlots(fresh);
        setPicked(null);
        setBusy(false);
        return;
      }
      if (!r.ok) throw new Error(j.error || 'reschedule_failed');
      onSaved();
    } catch (e) { setErr(String(e.message || 'Could not reschedule')); }
    finally { setBusy(false); }
  };

  const allSlots = slots
    ? [...(slots.groups?.morning || []), ...(slots.groups?.afternoon || []), ...(slots.groups?.evening || [])]
    : [];

  return (
    <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Reschedule</div>
            <h2 className="mt-1 font-serif text-2xl">Pick a new time</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {therapySlugs.length} {therapySlugs.length === 1 ? 'therapy' : 'therapies'}
              {sessionMode ? ` · ${sessionMode} float` : ''}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted inline-flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        {conflictHint && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-500/5 p-3 text-[12.5px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{conflictHint}
          </div>
        )}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const iso = toIsoDay(d);
            const sel = date === iso;
            return (
              <button key={iso} onClick={() => { setDate(iso); setPicked(null); }}
                className={`shrink-0 w-[80px] rounded-xl border py-2.5 flex flex-col items-center transition-all ${sel ? 'border-brand bg-brand-soft text-foreground' : 'border-border bg-card hover:border-foreground/40'}`}>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                <div className={`mt-0.5 font-serif text-[20px] leading-none ${sel ? 'text-brand' : ''}`}>{d.getDate()}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-[12.5px] text-muted-foreground py-6">Loading available slots…</div>
          ) : allSlots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-[12.5px] text-muted-foreground">No slots on this date. Pick a different day.</div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {allSlots.map((s) => (
                <button key={s.time} onClick={() => setPicked(s)}
                  className={`rounded-lg border py-2 font-mono text-[13px] font-semibold transition-all ${picked?.time === s.time ? 'border-brand bg-brand text-white' : 'border-border bg-card hover:border-foreground/40'}`}>
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>

        {err && <div className="mt-3 text-[12px] text-red-600">{err}</div>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-border hover:bg-muted">Keep current time</button>
          <button onClick={submit} disabled={busy || !picked} className="h-9 px-3 rounded-md text-[12.5px] font-semibold bg-foreground text-background disabled:opacity-40">
            {busy ? 'Rescheduling…' : (picked ? `Confirm ${picked.time}` : 'Pick a time')}
          </button>
        </div>
      </div>
    </div>
  );
}
