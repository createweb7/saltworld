'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, Loader2, Clock, Calendar as Cal,
  MapPin, Phone, MessageCircle, Sparkles,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';
import { Wordmark } from '@/components/site/shell';
import { OUTCOMES, getOutcome } from '@/lib/outcomes';

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: 'outcome',  label: 'Outcome' },
  { id: 'therapy',  label: 'Therapy' },
  { id: 'slot',     label: 'Date & time' },
  { id: 'contact',  label: 'Confirm' },
];

function fmtDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}
function toIsoDay(d) {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Header  — progress                                                 */
/* ------------------------------------------------------------------ */

function BookingHeader({ stepIdx, onBack, summary }) {
  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {stepIdx > 0 ? (
            <button onClick={onBack} aria-label="Back"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/" aria-label="Back to home"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="hidden md:block"><Wordmark /></div>
        </div>
        <div className="flex-1 md:hidden text-center text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
          {STEPS[stepIdx].label} · {stepIdx + 1}/{STEPS.length}
        </div>
        <div className="hidden md:flex items-center gap-3 text-[12px]">
          {STEPS.map((s, i) => (
            <div key={s.id} className={cn(
              'flex items-center gap-1.5',
              i === stepIdx ? 'text-foreground font-medium' : i < stepIdx ? 'text-brand' : 'text-muted-foreground'
            )}>
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                i === stepIdx ? 'bg-foreground text-background' : i < stepIdx ? 'bg-brand text-white' : 'bg-muted border border-border'
              )}>
                {i < stepIdx ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </div>
              <span>{s.label}</span>
              {i < STEPS.length - 1 && <span className="opacity-30 mx-1">—</span>}
            </div>
          ))}
        </div>
        <div className="w-9 md:hidden" />
      </div>
      <div className="h-0.5 bg-muted overflow-hidden">
        <div className="h-full bg-brand transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Outcome                                                   */
/* ------------------------------------------------------------------ */

function StepOutcome({ value, onChange }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 1 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        What brings you <span className="italic">here today?</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[540px]">
        Choose how you want to feel. We’ll match you with the right protocol on the next screen.
      </p>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OUTCOMES.map((o) => {
          const isSel = value === o.slug;
          return (
            <button key={o.slug} onClick={() => onChange(o.slug)}
              className={cn(
                'text-left rounded-2xl border p-5 flex items-start gap-4 transition-all',
                isSel ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:border-foreground/40'
              )}>
              <div className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0',
                isSel ? 'bg-brand text-white' : 'bg-brand/10 text-brand'
              )}>
                <o.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-serif text-[19px] leading-tight text-foreground">{o.title}</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground text-pretty">{o.eyebrow}</div>
              </div>
              <div className={cn(
                'mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                isSel ? 'border-brand bg-brand' : 'border-border'
              )}>
                {isSel && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Therapy                                                   */
/* ------------------------------------------------------------------ */

const PRICE_MULTIPLIER = { primary: 1.0, adjunct: 0.5, track: 0.65 };

function parsePrice(str) {
  return Number(String(str || '0').replace(/[^\d]/g, '')) || 0;
}

function StepTherapy({ outcome, values, onChange, mappingOverride }) {
  const o = getOutcome(outcome);
  // Prefer DB override (admin-configurable), fall back to static outcome data.
  const therapies = mappingOverride?.length ? mappingOverride : (o?.protocol?.therapies || []);
  const basePrice = parsePrice(o?.pricing?.single?.price);
  const baseDuration = parseInt(String(o?.protocol?.duration || '45'), 10) || 45;

  const toggle = (slug) => {
    const set = new Set(values);
    if (set.has(slug)) {
      // Never allow zero-selection — keep at least one therapy.
      if (set.size > 1) set.delete(slug);
    } else {
      set.add(slug);
    }
    onChange(Array.from(set));
  };

  // Live journey recalc
  const selected = therapies.filter((t) => values.includes(t.slug));
  const combinedDuration = selected.reduce((sum, t) => sum + (t.durationMin || baseDuration), 0) || baseDuration;
  const combinedPrice    = selected.reduce((sum, t) => {
    const role = String(t.role || '').toLowerCase();
    const mult = PRICE_MULTIPLIER[role] ?? 0.5;
    return sum + Math.round(basePrice * mult);
  }, 0) || basePrice;
  const journeyLabel = selected.length === 1
    ? selected[0].label
    : `${selected.length}-therapy ${o?.title?.toLowerCase() || 'wellness'} journey`;

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 2 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        For {o?.title?.toLowerCase()}, <br className="hidden md:block" /><span className="italic">we recommend.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[600px]">
        Pick one therapy, or combine several — we&rsquo;ll sequence them into a single session. Your therapist will confirm the exact protocol at check-in.
      </p>

      <div className="mt-10 space-y-3">
        {therapies.map((t) => {
          const isSel = values.includes(t.slug);
          return (
            <button key={t.slug} onClick={() => toggle(t.slug)}
              type="button"
              className={cn(
                'w-full text-left rounded-2xl border p-5 md:p-6 flex items-center gap-4 transition-all',
                isSel ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:border-foreground/40'
              )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-serif text-[22px] md:text-[26px] leading-tight text-foreground">{t.label}</div>
                  <span className={cn(
                    'text-[10.5px] uppercase tracking-[0.16em] font-semibold',
                    isSel ? 'text-brand' : 'text-muted-foreground'
                  )}>{t.role}</span>
                </div>
                {t.description && (
                  <div className="mt-1 text-[12.5px] text-muted-foreground line-clamp-1">{t.description}</div>
                )}
                <div className="mt-1 text-[13px] text-muted-foreground">{t.durationMin ? `${t.durationMin} min` : (o?.protocol?.duration || '45 min')}</div>
              </div>
              {/* Checkbox instead of radio — enables multi-select */}
              <div className={cn(
                'h-5 w-5 rounded-[6px] border-2 flex items-center justify-center shrink-0',
                isSel ? 'border-brand bg-brand' : 'border-border'
              )}>
                {isSel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Combined journey summary — updates as therapies are toggled */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">Your journey</div>
        <div className="font-serif text-[19px] leading-tight tracking-tight text-balance">{journeyLabel}</div>
        <div className="mt-3 flex items-center gap-x-6 gap-y-1.5 flex-wrap text-[13px]">
          <div className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span><span className="font-semibold">{combinedDuration}</span> min total</span></div>
          <div className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-muted-foreground" /><span><span className="font-semibold">{selected.length}</span> therapy{selected.length === 1 ? '' : ' combo'}</span></div>
          <div className="ml-auto font-mono text-[15px] font-semibold">₹{combinedPrice.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Wellness Journey planner (Auto + Manual modes)            */
/* ------------------------------------------------------------------ */

function fmtTimeRange(fromIso, toIso) {
  const f = new Date(fromIso), t = new Date(toIso);
  const pad = (n) => String(n).padStart(2, '0');
  // IST offset (fixed +05:30)
  const shift = (d) => new Date(d.getTime() + 330 * 60000);
  const hf = shift(f), ht = shift(t);
  return `${pad(hf.getUTCHours())}:${pad(hf.getUTCMinutes())} – ${pad(ht.getUTCHours())}:${pad(ht.getUTCMinutes())}`;
}
function fmtVisit(mins) {
  if (!mins) return '—';
  if (mins >= 60) return `${Math.floor(mins/60)}h ${mins%60 ? (mins%60)+'m' : ''}`.trim();
  return `${mins}m`;
}

function StepSlot({ therapies, therapyMeta, value, onChange, sessionMode, setSessionMode }) {
  const days = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return d;
    });
  }, []);
  const [date, setDate] = useState(value?.date || toIsoDay(days[0]));
  const isMulti = therapies.length > 1;
  const [mode, setMode] = useState(isMulti ? 'auto' : 'manual');
  const [journeyData, setJourneyData] = useState(null); // full journey response for auto mode + summary
  const [loading, setLoading] = useState(false);
  const hasFloat = therapies.some((t) => String(t).includes('float'));

  // Fetch the full journey slot data (needed for auto mode + summary in both modes)
  useEffect(() => {
    if (therapies.length === 0 || !date) return;
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ therapies: therapies.join(','), date });
    if (hasFloat && sessionMode) q.set('sessionMode', sessionMode);
    fetch(`/api/scheduling/slots?${q}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) { setJourneyData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setJourneyData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [therapies, date, sessionMode, hasFloat]);

  const totalDurationMin = journeyData?.totalDurationMin || 0;
  const totalVisitMin    = journeyData?.totalVisitMin    || 0;

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 3 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        Plan your <span className="italic">wellness journey.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[560px]">
        Slots are calculated live from real resource availability.
      </p>

      {/* Journey summary */}
      {therapies.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Your wellness journey
          </div>
          <div className="mt-3 space-y-1.5">
            {therapies.map((slug) => {
              const meta = therapyMeta?.[slug];
              if (!meta) return null;
              return (
                <div key={slug} className="flex items-center justify-between text-[14px]">
                  <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand" /><span className="font-medium">{meta.name}</span></div>
                  <div className="text-[12.5px] text-muted-foreground font-mono">{meta.durationMin} min</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-[12.5px]">
            <div>
              <div className="text-muted-foreground">Therapy time</div>
              <div className="font-mono font-semibold text-[15px] mt-0.5">{totalDurationMin} min</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated visit</div>
              <div className="font-mono font-semibold text-[15px] mt-0.5">
                ~{fmtVisit(totalVisitMin)}
                <span className="ml-1.5 text-[10.5px] font-sans text-muted-foreground uppercase tracking-[0.14em]">incl. buffers</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Float session-mode toggle — only if float-therapy is in the journey */}
      {hasFloat && (
        <div className="mt-6">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Float session type</div>
          <div className="inline-flex rounded-full border border-border p-0.5 bg-card">
            <button type="button" onClick={() => { setSessionMode('single'); onChange(null); }}
              className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                sessionMode === 'single' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              Single
            </button>
            <button type="button" onClick={() => { setSessionMode('couple'); onChange(null); }}
              className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                sessionMode === 'couple' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground')}>
              Couple
            </button>
          </div>
          <div className="mt-2 text-[11.5px] text-muted-foreground max-w-[520px] leading-[1.5]">
            {sessionMode === 'couple'
              ? 'Couple sessions use a couple-capable float tank for two people together. Fewer tanks support couple mode — book early.'
              : 'Standard 60-minute float in a solo tank.'}
          </div>
        </div>
      )}

      {/* Date strip */}
      <div className="mt-8 -mx-4 md:mx-0">
        <div className="flex gap-2 overflow-x-auto px-4 md:px-0 no-scrollbar pb-2">
          {days.map((d) => {
            const iso = toIsoDay(d);
            const isSel = date === iso;
            return (
              <button key={iso} onClick={() => { setDate(iso); onChange(null); }}
                className={cn(
                  'shrink-0 w-[86px] rounded-2xl border py-3 flex flex-col items-center transition-all',
                  isSel ? 'border-brand bg-brand-soft text-foreground' : 'border-border bg-card hover:border-foreground/40'
                )}>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                <div className={cn('mt-1 font-serif text-[24px] leading-none', isSel && 'text-brand')}>{d.getDate()}</div>
                <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto / Manual toggle — only for multi-therapy journeys */}
      {isMulti && (
        <div className="mt-6 inline-flex rounded-full border border-border p-0.5 bg-card">
          <button onClick={() => { setMode('auto'); onChange(null); }}
            className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full flex items-center gap-1.5 transition-all',
              mode === 'auto' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground')}>
            <Sparkles className="h-3.5 w-3.5" /> Auto-build (recommended)
          </button>
          <button onClick={() => { setMode('manual'); onChange(null); }}
            className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
              mode === 'manual' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
            Choose manually
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center py-12 text-muted-foreground text-[13px] flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding available times…
        </div>
      )}

      {!loading && mode === 'auto' && (
        <AutoJourneyPicker journeyData={journeyData} date={date} therapyMeta={therapyMeta} value={value} onChange={onChange} />
      )}

      {!loading && mode === 'manual' && (
        <ManualJourneyPicker therapies={therapies} therapyMeta={therapyMeta} date={date} value={value} onChange={onChange} />
      )}
    </div>
  );
}

/* Auto mode — engine picks best fit; user can browse alternates. */
function AutoJourneyPicker({ journeyData, date, therapyMeta, value, onChange }) {
  const groups = journeyData?.groups || { morning: [], afternoon: [], evening: [] };
  const total = groups.morning.length + groups.afternoon.length + groups.evening.length;

  // If no slot picked yet, auto-select the first available (recommended).
  useEffect(() => {
    if (!value?.time && total > 0) {
      const first = groups.morning[0] || groups.afternoon[0] || groups.evening[0];
      if (first) onChange({ date, time: first.time, startIso: first.startIso, visitFromIso: first.visitFromIso, visitToIso: first.visitToIso, plan: first.plan });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyData]);

  if (total === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
        <div className="font-medium text-[15px]">No slots available on this day</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {journeyData?.closed ? 'The branch is closed on this day.' : 'The engine couldn\'t fit your journey. Try another day.'}
        </div>
      </div>
    );
  }

  const picked = value?.plan ? value : null;
  const alternates = [...groups.morning, ...groups.afternoon, ...groups.evening]
    .filter((s) => s.time !== value?.time)
    .slice(0, 5);

  return (
    <div className="mt-8 space-y-6">
      {picked && (
        <div className="rounded-2xl border border-brand/40 bg-brand-soft/40 p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-brand font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Recommended itinerary
            </div>
            <div className="text-[11.5px] text-muted-foreground">Starts <span className="font-mono font-semibold text-foreground">{picked.time}</span></div>
          </div>
          <div className="space-y-2.5">
            {(picked.plan || []).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-brand/10 text-brand text-[13px] font-semibold flex items-center justify-center shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate">{p.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">{p.durationMin} min</div>
                </div>
                <div className="font-mono text-[13px] font-semibold tracking-tight">{fmtTimeRange(p.from, p.to)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-brand/20 flex items-center justify-between text-[12.5px]">
            <div className="text-muted-foreground">Total visit</div>
            <div className="font-mono font-semibold">~{fmtVisit(journeyData.totalVisitMin)}</div>
          </div>
        </div>
      )}
      {alternates.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Or start at</div>
          <div className="flex flex-wrap gap-2">
            {alternates.map((s) => (
              <button key={s.time} onClick={() => onChange({ date, time: s.time, startIso: s.startIso, visitFromIso: s.visitFromIso, visitToIso: s.visitToIso, plan: s.plan })}
                className="h-10 px-3.5 rounded-full border border-border bg-card hover:border-foreground/40 text-[13px] font-mono font-semibold transition-all">
                {s.time}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Manual mode — one card per therapy, downstream cards filter by prior pick. */
function ManualJourneyPicker({ therapies, therapyMeta, date, value, onChange }) {
  // picks[i] = { time, startIso, endIso, planEntry } for therapy i, or undefined
  const [picks, setPicks] = useState(() => value?.plan
    ? value.plan.map((p) => ({ time: p.from ? new Date(new Date(p.from).getTime() + 330*60000).toISOString().slice(11,16) : null, startIso: p.from, endIso: p.to }))
    : []
  );
  const [slotsByIdx, setSlotsByIdx] = useState({});
  const [loadingIdx, setLoadingIdx] = useState(null);

  // Compute "after" cutoff (HH:mm local) for therapy index i, based on picks[i-1].
  const cutoffFor = (i) => {
    if (i === 0) return null;
    const prev = picks[i - 1];
    if (!prev?.endIso) return null;
    const prevTherapy = therapyMeta[therapies[i - 1]];
    const nextTherapy = therapyMeta[therapies[i]];
    const gap = Math.max(
      (prevTherapy?.postBufferMin || 0) + (nextTherapy?.preBufferMin || 0),
      (prevTherapy?.cleaningBufferMin || 0),
    );
    const cutoffMs = new Date(prev.endIso).getTime() + gap * 60000;
    const shifted = new Date(cutoffMs + 330 * 60000);
    return `${String(shifted.getUTCHours()).padStart(2,'0')}:${String(shifted.getUTCMinutes()).padStart(2,'0')}`;
  };

  // Fetch slots for a given therapy index.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < therapies.length; i++) {
        // Skip fetching for card i if the prior card hasn't been picked yet.
        if (i > 0 && !picks[i - 1]?.endIso) { setSlotsByIdx((s) => ({ ...s, [i]: null })); continue; }
        setLoadingIdx(i);
        const q = new URLSearchParams({ therapy: therapies[i], date });
        const after = cutoffFor(i);
        if (after) q.set('after', after);
        try {
          const r = await fetch(`/api/scheduling/therapy-slots?${q}`);
          const d = r.ok ? await r.json() : null;
          if (cancelled) return;
          setSlotsByIdx((s) => ({ ...s, [i]: d }));
        } catch { if (!cancelled) setSlotsByIdx((s) => ({ ...s, [i]: null })); }
      }
      if (!cancelled) setLoadingIdx(null);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapies.join(','), date, picks.map((p) => p?.endIso || '').join(',')]);

  const pickSlot = (i, slot) => {
    const meta = therapyMeta[therapies[i]];
    const dur = meta?.durationMin || 60;
    const startIso = slot.startIso;
    const endIso = new Date(new Date(startIso).getTime() + dur * 60000).toISOString();
    const next = picks.slice(0, i);
    next[i] = { time: slot.time, startIso, endIso };
    // Reset downstream picks (they need to be re-selected against new cutoff)
    setPicks(next);
    // If this was the last therapy, commit the journey to parent
    if (i === therapies.length - 1) {
      const plan = next.map((p, idx) => ({
        therapySlug: therapies[idx],
        name: therapyMeta[therapies[idx]]?.name,
        from: p.startIso,
        to: p.endIso,
        durationMin: therapyMeta[therapies[idx]]?.durationMin,
      }));
      onChange({
        date,
        time: next[0].time,
        startIso: next[0].startIso,
        visitFromIso: next[0].startIso,
        visitToIso: next[next.length - 1].endIso,
        plan,
      });
    } else {
      onChange(null); // clear committed value until all therapies picked
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {therapies.map((slug, i) => {
        const meta = therapyMeta[slug];
        if (!meta) return null;
        const data = slotsByIdx[i];
        const locked = i > 0 && !picks[i - 1]?.endIso;
        const groups = data?.groups || { morning: [], afternoon: [], evening: [] };
        const total = groups.morning.length + groups.afternoon.length + groups.evening.length;
        const cutoff = cutoffFor(i);
        return (
          <div key={i} className={cn(
            'rounded-2xl border p-5 md:p-6 transition-all',
            locked ? 'border-dashed border-border/60 bg-muted/30 opacity-60' : 'border-border bg-card',
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-semibold',
                  picks[i]?.time ? 'bg-brand text-white' : 'bg-muted text-muted-foreground')}>{i + 1}</div>
                <div>
                  <div className="text-[15px] font-medium">{meta.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">{meta.durationMin} min{cutoff && !locked && <span> · earliest {cutoff}</span>}</div>
                </div>
              </div>
              {picks[i]?.time && <div className="font-mono text-[13px] font-semibold px-3 h-8 rounded-full bg-brand/10 text-brand inline-flex items-center">{picks[i].time}</div>}
            </div>
            {locked && (
              <div className="text-[12.5px] text-muted-foreground italic">Pick {therapyMeta[therapies[i-1]]?.name || 'previous therapy'} time first.</div>
            )}
            {!locked && data === null && loadingIdx === i && (
              <div className="text-[12.5px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Loading times…</div>
            )}
            {!locked && data && total === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">
                No compatible slots remain after your previous choice. Try adjusting an earlier therapy.
              </div>
            )}
            {!locked && data && total > 0 && (
              <div className="space-y-4">
                {['morning', 'afternoon', 'evening'].map((k) => {
                  const arr = groups[k];
                  if (arr.length === 0) return null;
                  return (
                    <div key={k}>
                      <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2">{k}</div>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {arr.slice(0, 15).map((s) => {
                          const isSel = picks[i]?.time === s.time;
                          return (
                            <button key={s.time} onClick={() => pickSlot(i, s)}
                              className={cn('rounded-xl border py-2.5 px-2 font-mono text-[13px] font-semibold tracking-tight transition-all',
                                isSel ? 'border-brand bg-brand text-white' : 'border-border bg-card hover:border-foreground/40')}>
                              {s.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Contact & confirm                                         */
/* ------------------------------------------------------------------ */

function StepContact({ outcome, therapy, therapies = [], therapyMeta = {}, slot, contact, setContact, payment, setPayment, submitting, onSubmit, error, canPayOnline, slotConflict, onPickSuggestion }) {
  const o = getOutcome(outcome);
  const th = o?.protocol?.therapies?.find((x) => x.slug === therapy);
  const isMulti = therapies.length > 1 && slot?.plan?.length > 1;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 4 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        A few details, <span className="italic">then you&rsquo;re booked.</span>
      </h1>

      {slotConflict && Array.isArray(slotConflict.suggestions) && (
        <div className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-8 w-8 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center justify-center flex-shrink-0">!</div>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-amber-900 dark:text-amber-200">This slot was just booked by another guest.</div>
              <div className="mt-0.5 text-[12.5px] leading-[1.55] text-amber-800/85 dark:text-amber-200/80">
                No booking was created and no payment was taken. Pick one of the nearby times below to keep going.
              </div>
              {slotConflict.suggestions.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                  {slotConflict.suggestions.map((s, i) => (
                    <button key={`${s.date}-${s.time}-${i}`} type="button" onClick={() => onPickSuggestion?.(s)}
                      className="rounded-xl border border-amber-300/70 dark:border-amber-800 bg-background hover:border-foreground/40 hover:bg-card transition-colors p-3 text-left">
                      <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{new Date(`${s.date}T00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                      <div className="mt-1 font-mono text-[15px] font-semibold">{s.time}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-[12px] text-amber-800 dark:text-amber-300">No nearby slots today or tomorrow. Please go back and pick a different date.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="name" className="block text-[12px] font-medium mb-1.5">Full name<span className="text-destructive ml-0.5">*</span></label>
              <input id="name" type="text" required minLength={2}
                value={contact.name || ''} onChange={(e) => setContact({ ...contact, name: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-[12px] font-medium mb-1.5">Phone<span className="text-destructive ml-0.5">*</span></label>
              <input id="phone" type="tel" required pattern="^[0-9+\-\s]{7,15}$"
                value={contact.phone || ''} onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="+91 …"
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-[12px] font-medium mb-1.5">Email <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input id="email" type="email"
              value={contact.email || ''} onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>
          <div>
            <label htmlFor="notes" className="block text-[12px] font-medium mb-1.5">Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea id="notes" rows={3}
              value={contact.notes || ''} onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-[14px] leading-6 focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>

          <div>
            <div className="text-[12px] font-medium mb-2">Payment</div>
            <div className="space-y-2">
              <label className={cn('flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer',
                payment === 'at-visit' ? 'border-brand bg-brand-soft' : 'border-border')}>
                <input type="radio" name="pay" checked={payment === 'at-visit'} onChange={() => setPayment('at-visit')} className="sr-only" />
                <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center', payment === 'at-visit' ? 'border-brand' : 'border-border')}>
                  {payment === 'at-visit' && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-medium">Pay at visit</div>
                  <div className="text-[12px] text-muted-foreground">Card / UPI at reception. Nothing charged now.</div>
                </div>
              </label>
              <label className={cn('flex items-center gap-3 rounded-xl border p-3.5',
                canPayOnline ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed',
                payment === 'online' ? 'border-brand bg-brand-soft' : 'border-border')}>
                <input type="radio" name="pay" disabled={!canPayOnline} checked={payment === 'online'} onChange={() => setPayment('online')} className="sr-only" />
                <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center', payment === 'online' ? 'border-brand' : 'border-border')}>
                  {payment === 'online' && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-medium flex items-center gap-2">
                    Pay online
                    {!canPayOnline && <span className="text-[10px] uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded">Soon</span>}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {canPayOnline ? 'Cards, UPI, netbanking via Razorpay. Secure by default.' : 'Available once payments are enabled.'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-[13px] px-3 py-2">{error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background text-[14.5px] font-semibold hover:bg-foreground/90 disabled:opacity-60 transition-colors">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {payment === 'online' ? 'Opening secure checkout…' : 'Confirming…'}</> : <>{payment === 'online' ? 'Pay & confirm booking' : 'Confirm booking'} <ArrowRight className="h-4 w-4" /></>}
          </button>
          <div className="text-[11.5px] text-muted-foreground text-center">
            By confirming, you agree to our <Link href="/legal/terms" className="underline underline-offset-2">terms</Link> &amp; <Link href="/legal/refunds" className="underline underline-offset-2">refund policy</Link>.
          </div>
        </form>

        {/* Summary card */}
        <aside className="rounded-2xl border border-border bg-card p-5 md:p-6 h-fit md:sticky md:top-24">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Your booking</div>
          {isMulti ? (
            <>
              <div className="mt-4 space-y-2.5">
                {(slot.plan || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-brand/10 text-brand text-[11px] font-semibold flex items-center justify-center shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.name || therapyMeta[p.therapySlug]?.name}</div>
                      <div className="text-[11px] text-muted-foreground">{p.durationMin || therapyMeta[p.therapySlug]?.durationMin} min</div>
                    </div>
                    <div className="font-mono text-[12px] font-semibold text-right whitespace-nowrap">{fmtTimeRange(p.from, p.to)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border space-y-2 text-[12.5px]">
                <Row label="Date" value={slot ? new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }) : '—'} />
                <Row label="Therapy time" value={`${(slot.plan||[]).reduce((s,p)=>s+(p.durationMin||therapyMeta[p.therapySlug]?.durationMin||0),0)} min`} />
                <Row label="Estimated visit" value={slot.visitFromIso && slot.visitToIso ? `~${fmtVisit(Math.round((new Date(slot.visitToIso)-new Date(slot.visitFromIso))/60000))}` : '—'} />
                <Row label="Branch" value="HSR Layout" />
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-3 text-[13.5px]">
              <Row label="Outcome" value={o?.title} />
              <Row label="Therapy" value={th?.label} />
              <Row label="Date"    value={slot ? new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }) : '—'} />
              <Row label="Time"    value={slot?.time || '—'} />
              <Row label="Duration" value={o?.protocol?.duration || '—'} />
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border flex items-baseline justify-between">
            <span className="text-[12.5px] text-muted-foreground">Total (est.)</span>
            <span className="font-serif text-[28px] tracking-tight">{o?.pricing?.single?.price}</span>
          </div>
          <div className="mt-4 flex items-start gap-2 text-[11.5px] text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Salt World, HSR Layout, Bengaluru 560102</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value || '—'}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Client root                                                        */
/* ------------------------------------------------------------------ */

export default function BookingClient({ initialOutcome }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stepIdx, setStepIdx] = useState(initialOutcome ? 1 : 0);
  const [outcome, setOutcome] = useState(initialOutcome);
  // therapies is now an ARRAY of slugs (multi-select). Legacy single-value `therapy`
  // is derived as therapies[0] for compatibility with backend + confirmation flow.
  const [therapies, setTherapies] = useState([]);
  const [slot, setSlot] = useState(null);
  const [contact, setContact] = useState({});
  const [customerId, setCustomerId] = useState(null);
  const [payment, setPayment] = useState('at-visit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [payCfg, setPayCfg] = useState({ configured: false, keyId: null });
  const [outcomeMap, setOutcomeMap] = useState(null); // admin-configured overrides
  const [therapyMeta, setTherapyMeta] = useState({}); // slug → {name, durationMin, ...} from DB
  const [sessionMode, setSessionMode] = useState('single'); // float-therapy: single | couple
  // Suggestions surfaced when the confirm step receives a 409 slot_unavailable
  const [slotConflict, setSlotConflict] = useState(null); // { reason, suggestions:[{...}] }
  const therapy = therapies[0] || null; // convenience alias

  // Load therapy metadata once (for the journey summary in step 3).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/therapies')
      .then((r) => r.ok ? r.json() : [])
      .then((docs) => {
        if (cancelled) return;
        const bySlug = {};
        for (const d of docs) bySlug[d.slug] = d;
        setTherapyMeta(bySlug);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Pre-fill contact from query params (used when staff launches "New booking" from
  // /admin/customers/:id — we hand off to the same flow with contact already known).
  useEffect(() => {
    const name  = searchParams.get('name');
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');
    const cid   = searchParams.get('customerId');
    if (name || phone || email) {
      setContact((prev) => ({
        ...prev,
        name:  prev.name  || name  || '',
        phone: prev.phone || phone || '',
        email: prev.email || email || '',
      }));
    }
    if (cid) setCustomerId(cid);
  }, [searchParams]);

  // Auto-select the primary therapy when outcome changes.
  useEffect(() => {
    if (outcome && therapies.length === 0) {
      const o = getOutcome(outcome);
      const primary = o?.protocol?.therapies?.find((x) => String(x.role || '').toLowerCase() === 'primary')
                    || o?.protocol?.therapies?.[0];
      if (primary?.slug) setTherapies([primary.slug]);
    }
  }, [outcome, therapies.length]);

  // Fetch admin-configured outcome→therapy mapping if any (falls back silently).
  useEffect(() => {
    if (!outcome) return;
    let cancelled = false;
    fetch(`/api/outcome-mapping/${outcome}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setOutcomeMap(d);
        if (Array.isArray(d.defaultSelected) && d.defaultSelected.length > 0 && therapies.length <= 1) {
          setTherapies(d.defaultSelected);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [stepIdx]);

  // Fetch payment configuration once — we only surface "Pay online" if Razorpay is truly configured.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/status').then((r) => r.json()).then((d) => {
      if (!cancelled && d?.configured) setPayCfg({ configured: true, keyId: d.keyId });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const canNext =
    (stepIdx === 0 && !!outcome) ||
    (stepIdx === 1 && therapies.length > 0) ||
    (stepIdx === 2 && !!slot?.date && !!slot?.time) ||
    stepIdx === 3;

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const openRazorpay = ({ order, keyId, bookingId, bookingRef, name, contact }) => new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.Razorpay === 'undefined') {
      reject(new Error('Payment gateway not ready. Please refresh and try again.'));
      return;
    }
    const rzp = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Salt World',
      description: `Booking ${bookingRef}`,
      order_id: order.id,
      prefill: {
        name: contact?.name || '',
        email: contact?.email || '',
        contact: contact?.phone || '',
      },
      theme: { color: '#0a3838' },
      handler: async (response) => {
        try {
          const v = await fetch('/api/payments/verify-signature', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const j = await v.json();
          if (!v.ok || !j?.success) return reject(new Error('Signature verification failed.'));
          resolve({ ok: true });
        } catch (e) { reject(e); }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    });
    rzp.open();
  });

  const submit = async () => {
    setError(null);
    if (!contact.name || !contact.phone) { setError('Name and phone are required.'); return; }
    if (therapies.length === 0) { setError('Please pick at least one therapy.'); return; }
    setSubmitting(true);
    try {
      const o = getOutcome(outcome);
      const staticTherapies = o?.protocol?.therapies || [];
      const merged = (outcomeMap?.therapies?.length ? outcomeMap.therapies : staticTherapies);
      const selected = merged.filter((t) => therapies.includes(t.slug));
      const basePrice = parsePrice(o?.pricing?.single?.price);
      const totalRupees = selected.reduce((sum, t) => {
        const role = String(t.role || '').toLowerCase();
        const mult = PRICE_MULTIPLIER[role] ?? 0.5;
        return sum + Math.round(basePrice * mult);
      }, 0) || basePrice;
      const primary = selected.find((t) => String(t.role || '').toLowerCase() === 'primary') || selected[0];

      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome, outcomeLabel: o?.title,
          therapy: primary?.slug || null,
          therapyLabel: primary?.label || null,
          therapies: selected.map((t) => ({ slug: t.slug, label: t.label, role: t.role })),
          sessionMode: therapies.some((s) => String(s).includes('float')) ? sessionMode : null,
          slotDate: slot.date, slotTime: slot.time,
          startAt: slot.startIso || null,
          plan: slot.plan || null,
          duration: o?.protocol?.duration,
          contact, payment,
          customerId,
          priceLine: o?.pricing?.single?.price + ' ' + (o?.pricing?.single?.period || ''),
          total: totalRupees,
        }),
      });
      if (r.status === 409) {
        // Slot got taken while the customer was checking out. Do NOT create
        // the booking — surface friendly suggestions so they can pick another
        // slot without restarting the flow.
        const j = await r.json().catch(() => ({}));
        setSlotConflict({ reason: j.reason || 'slot_unavailable', suggestions: j.suggestions || [] });
        setError('This slot was just booked. Please pick a nearby time below.');
        setSubmitting(false);
        return;
      }
      if (!r.ok) throw new Error('Failed to create booking');
      const doc = await r.json();
      setSlotConflict(null);

      // If online payment requested and Razorpay is configured, open Checkout.
      if (payment === 'online' && payCfg.configured && totalRupees > 0) {
        const co = await fetch('/api/payments/create-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: doc.id, amountPaise: Math.round(totalRupees * 100), notes: { ref: doc.ref } }),
        });
        const coJson = await co.json();
        if (!co.ok) throw new Error(coJson?.error || 'Could not initialise payment.');
        await openRazorpay({
          order: coJson.order,
          keyId: coJson.keyId || payCfg.keyId,
          bookingId: doc.id,
          bookingRef: doc.ref,
          contact,
        });
      }

      router.push(`/book/confirm/${doc.id}`);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {payCfg.configured && (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      )}
      <BookingHeader stepIdx={stepIdx} onBack={back} />

      <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-28 md:pb-16">
        {stepIdx === 0 && <StepOutcome value={outcome} onChange={(v) => { setOutcome(v); setTherapies([]); setOutcomeMap(null); }} />}
        {stepIdx === 1 && <StepTherapy outcome={outcome} values={therapies} onChange={setTherapies} mappingOverride={outcomeMap?.therapies} />}
        {stepIdx === 2 && <StepSlot therapies={therapies} therapyMeta={therapyMeta} value={slot} onChange={setSlot} sessionMode={sessionMode} setSessionMode={setSessionMode} />}
        {stepIdx === 3 && (
          <StepContact
            outcome={outcome} therapy={therapy} slot={slot}
            therapies={therapies} therapyMeta={therapyMeta}
            contact={contact} setContact={setContact}
            payment={payment} setPayment={setPayment}
            canPayOnline={payCfg.configured}
            submitting={submitting} error={error} onSubmit={submit}
            slotConflict={slotConflict}
            onPickSuggestion={(s) => {
              setSlot({
                date: s.date,
                time: s.time,
                startIso: s.startIso,
                visitFromIso: s.visitFromIso,
                visitToIso: s.visitToIso,
                plan: s.plan || [],
              });
              setSlotConflict(null);
              setError(null);
            }}
          />
        )}
      </main>

      {/* Sticky footer with primary action (steps 1–3 only; step 4 has its own submit) */}
      {stepIdx < 3 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
            <div className="hidden md:block text-[12.5px] text-muted-foreground">
              {stepIdx === 0 && (outcome ? `→ ${getOutcome(outcome)?.title}` : 'Choose the outcome you want')}
              {stepIdx === 1 && (therapies.length > 0
                ? `→ ${therapies.length} ${therapies.length === 1 ? 'therapy' : 'therapies'} selected`
                : 'Choose one or more therapies')}
              {stepIdx === 2 && (slot ? `→ ${new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} at ${slot.time}` : 'Pick a date and time')}
            </div>
            <button onClick={next} disabled={!canNext}
              className="ml-auto inline-flex items-center gap-2 h-11 px-6 rounded-full bg-foreground text-background text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-foreground/90 transition-colors">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
