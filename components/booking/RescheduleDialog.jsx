'use client';

// Shared "pick a new time" dialog — used by both the customer's account
// booking page (app/account/bookings/[id]/BookingActions.jsx) and the admin
// booking detail page (app/admin/bookings/[id]/BookingDetailClient.jsx).
// Same booking shape (both go through toBookingFull), same scheduling
// engine, same auto/manual UX — only the API base path and auth differ,
// which the caller supplies via `basePath` (e.g. `/api/bookings/:id` for
// customers, `/api/admin/bookings/:id` for staff).

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X, Clock, Check } from 'lucide-react';

const IST_OFFSET_MIN = 330;

function toIsoDay(d) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return shifted.toISOString().slice(0, 10);
}

function fmtTimeRange(fromIso, toIso) {
  const f = new Date(fromIso), t = new Date(toIso);
  const pad = (n) => String(n).padStart(2, '0');
  const shift = (d) => new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  const hf = shift(f), ht = shift(t);
  return `${pad(hf.getUTCHours())}:${pad(hf.getUTCMinutes())} – ${pad(ht.getUTCHours())}:${pad(ht.getUTCMinutes())}`;
}

function fmtVisit(mins) {
  if (!mins) return '—';
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60 ? (mins % 60) + 'm' : ''}`.trim();
  return `${mins}m`;
}

// Every 15 min, 08:00 to 19:45, matching the main booking flow's grid.
const PREFERRED_TIME_OPTIONS = (() => {
  const arr = [];
  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 15) arr.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return arr;
})();

export default function RescheduleDialog({ booking, basePath, onClose, onSaved }) {
  const therapySlugs = (booking.therapies || []).map((t) => t.slug).filter(Boolean);
  const sessionMode  = booking.sessionMode || null;

  const days = useMemo(() => {
    const arr = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  // Pre-fill the preferred time from the booking's current start, so
  // reopening at (roughly) the same time of day is a single tap away.
  const initialPreferred = useMemo(() => {
    if (!booking.startAt) return '08:00';
    const ist = new Date(new Date(booking.startAt).getTime() + IST_OFFSET_MIN * 60000);
    const hh = String(ist.getUTCHours()).padStart(2, '0');
    const mm = String(Math.round(ist.getUTCMinutes() / 15) * 15 % 60).padStart(2, '0');
    const guess = `${hh}:${mm}`;
    return PREFERRED_TIME_OPTIONS.includes(guess) ? guess : '08:00';
  }, [booking.startAt]);

  const [mode, setMode]         = useState('auto'); // 'auto' | 'manual'
  const [date, setDate]         = useState(toIsoDay(new Date()));
  const [picked, setPicked]     = useState(null); // { time, startIso, plan }
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);
  const [conflictHint, setConflictHint] = useState(null);

  // Manual mode — plain grid of every bookable time on the day.
  const [slots, setSlots]       = useState(null);
  const [loading, setLoading]   = useState(false);

  // Auto mode — preferred time + ranked recommendations, same engine as the
  // main booking flow's "best match / fastest / least waiting" cards.
  const [preferredTime, setPreferredTime] = useState(initialPreferred);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recExpanded, setRecExpanded] = useState(false);
  const [recOffset, setRecOffset] = useState(0);

  useEffect(() => {
    if (mode !== 'manual' || therapySlugs.length === 0 || !date) return;
    let ok = true;
    setLoading(true);
    const q = new URLSearchParams({ therapies: therapySlugs.join(','), date });
    if (sessionMode) q.set('sessionMode', sessionMode);
    fetch(`/api/scheduling/slots?${q}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (ok) { setSlots(d); setLoading(false); } })
      .catch(() => { if (ok) { setSlots(null); setLoading(false); } });
    return () => { ok = false; };
  }, [mode, date, therapySlugs.join(','), sessionMode]);

  useEffect(() => {
    if (mode !== 'auto' || therapySlugs.length === 0 || !date || !preferredTime) return;
    let ok = true;
    setRecLoading(true);
    setRecOffset(0);
    const q = new URLSearchParams({
      therapies: therapySlugs.join(','), date, preferred: preferredTime, limit: '3', offset: '0', window: '60',
    });
    if (sessionMode) q.set('sessionMode', sessionMode);
    fetch(`/api/scheduling/recommendations?${q}`)
      .then((r) => r.ok ? r.json() : { recommendations: [] })
      .then((d) => {
        if (!ok) return;
        setRecommendations(d.recommendations || []);
        setRecExpanded(!!d.expandedWindow);
        setRecLoading(false);
      })
      .catch(() => { if (ok) { setRecommendations([]); setRecExpanded(false); setRecLoading(false); } });
    return () => { ok = false; };
  }, [mode, date, preferredTime, therapySlugs.join(','), sessionMode]);

  const loadMoreRecommendations = async () => {
    setRecLoading(true);
    const nextOffset = recOffset + 3;
    const q = new URLSearchParams({
      therapies: therapySlugs.join(','), date, preferred: preferredTime, limit: '3', offset: String(nextOffset), window: '60',
    });
    if (sessionMode) q.set('sessionMode', sessionMode);
    try {
      const d = await fetch(`/api/scheduling/recommendations?${q}`).then((r) => r.json());
      const more = (d.recommendations || []).filter(
        (n) => !recommendations.some((cur) => cur.startIso === n.startIso && cur.orderKey === n.orderKey),
      );
      if (more.length > 0) setRecommendations([...recommendations, ...more]);
      setRecOffset(nextOffset);
    } catch { /* silent */ }
    setRecLoading(false);
  };

  const submit = async () => {
    if (!picked) return setErr('Please pick a new time.');
    setBusy(true); setErr(null); setConflictHint(null);
    try {
      const r = await fetch(`${basePath}/reschedule`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: picked.startIso,
          slotDate: date,
          slotTime: picked.time,
          sessionMode,
          plan: picked.plan || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) {
        setConflictHint('That time just got taken. Please pick another below.');
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

        <div className="mt-4 inline-flex rounded-full border border-border p-0.5 bg-card">
          <button type="button" onClick={() => { setMode('auto'); setPicked(null); }}
            className={`h-8 px-3.5 text-[12px] font-medium rounded-full transition-all ${mode === 'auto' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
            Best time for me
          </button>
          <button type="button" onClick={() => { setMode('manual'); setPicked(null); }}
            className={`h-8 px-3.5 text-[12px] font-medium rounded-full transition-all ${mode === 'manual' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
            Choose a specific time
          </button>
        </div>

        {mode === 'auto' ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="reschedulePreferredTime" className="text-[12px] font-medium text-muted-foreground">Preferred time</label>
              <select
                id="reschedulePreferredTime"
                value={preferredTime}
                onChange={(e) => { setPreferredTime(e.target.value); setPicked(null); }}
                className="h-10 rounded-lg border border-border bg-background px-3 text-[14px] font-mono font-semibold focus:outline-none focus:border-foreground/40"
              >
                {PREFERRED_TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {recLoading && recommendations.length === 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 py-8 text-[12.5px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5 animate-spin" /> Finding the best times for this date&hellip;
              </div>
            )}

            {!recLoading && recommendations.length === 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground text-[12.5px]">
                No availability near {preferredTime} on this day. Try a different preferred time, or
                <button type="button" onClick={() => setMode('manual')} className="ml-1 underline underline-offset-2 hover:text-foreground">
                  choose a specific time
                </button>.
              </div>
            )}

            {recommendations.length > 0 && (
              <>
                {recExpanded && (
                  <div className="mt-3 rounded-lg border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-500/5 px-3.5 py-2.5 text-[12px] text-amber-900 dark:text-amber-200 leading-[1.5]">
                    Nothing available around <span className="font-mono font-semibold">{preferredTime}</span> — showing the closest options instead.
                  </div>
                )}
                <div className={`mt-4 grid gap-3 transition-opacity ${recLoading ? 'opacity-40 pointer-events-none' : ''}`}>
                  {recommendations.map((r) => {
                    const isSel = picked?.startIso === r.startIso && (picked?.plan || []).map((p) => p.therapySlug).join('>') === (r.plan || []).map((p) => p.therapySlug).join('>');
                    return (
                      <button
                        key={r.startIso + (r.orderKey || '')}
                        type="button"
                        onClick={() => setPicked(r)}
                        className={`text-left rounded-xl border p-4 transition-all ${isSel ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-border bg-card hover:border-foreground/40'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2.5 flex-wrap">
                              <div className="font-serif text-[20px] tracking-tight leading-none">{r.time}</div>
                              {r.badgeLabel && (
                                <span className={`text-[10px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded-full
                                  ${r.badge === 'best_match' ? 'bg-brand text-white' : ''}
                                  ${r.badge === 'fastest_finish' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : ''}
                                  ${r.badge === 'least_waiting' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : ''}`}>
                                  {r.badgeLabel}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              {r.plan.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-[12.5px]">
                                  <span className="font-medium">{p.name}</span>
                                  <span className="text-muted-foreground font-mono text-[11px]">{fmtTimeRange(p.from, p.to)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {isSel && (
                            <div className="shrink-0 h-5 w-5 rounded-full bg-brand text-white flex items-center justify-center">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-4 text-[11px]">
                          <span className="text-muted-foreground">Total visit <span className="font-mono font-semibold text-foreground">~{fmtVisit(r.totalVisitMin)}</span></span>
                          <span className="text-muted-foreground">Waiting <span className="font-mono font-semibold text-foreground">{r.waitingMin > 0 ? `${r.waitingMin}m` : 'None'}</span></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <button type="button" onClick={loadMoreRecommendations} disabled={recLoading}
                    className="text-[12px] font-medium underline underline-offset-4 text-muted-foreground hover:text-foreground disabled:opacity-50">
                    {recLoading ? 'Loading…' : 'Show more times'}
                  </button>
                  <button type="button" onClick={() => setMode('manual')} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
                    Choose a specific time instead
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
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
        )}

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
