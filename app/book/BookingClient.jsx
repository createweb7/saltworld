'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, Loader2, Clock, Calendar as Cal,
  MapPin, Sparkles, ChevronUp, ChevronDown, Users,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';
import { Wordmark } from '@/components/site/shell';
import { InlineSignIn } from '@/components/site/inline-sign-in';
import { OUTCOMES, getOutcome, primaryOutcomeForTherapy } from '@/lib/outcomes';

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: 'outcome',  label: 'Outcome' },
  { id: 'therapy',  label: 'Therapy' },
  { id: 'slot',     label: 'Date & time' },
  { id: 'contact',  label: 'Confirm' },
];

// STEPS shown when the customer skips the outcome route (direct-therapy booking).
const STEPS_DIRECT = [
  { id: 'therapy',  label: 'Therapy' },
  { id: 'slot',     label: 'Date & time' },
  { id: 'contact',  label: 'Confirm' },
];

function fmtDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}
function toIsoDay(d) {
  // Emit LOCAL calendar date (yyyy-MM-dd) — never touch UTC. Using toISOString()
  // here previously shifted India-timezone midnights back one day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Header  — progress                                                 */
/* ------------------------------------------------------------------ */

function BookingHeader({ stepIdx, onBack, summary, steps = STEPS }) {
  const progress = ((stepIdx + 1) / steps.length) * 100;
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
          {steps[stepIdx].label} · {stepIdx + 1}/{steps.length}
        </div>
        <div className="hidden md:flex items-center gap-3 text-[12px]">
          {steps.map((s, i) => (
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
              {i < steps.length - 1 && <span className="opacity-30 mx-1">—</span>}
            </div>
          ))}
        </div>
        <div className="w-9 md:hidden" />
      </div>
      {/* `bg-muted` (93% lightness) sat almost indistinguishable from the
          header's own background (94%) — the unfilled track was invisible,
          so only the filled teal segment ever showed. `bg-border` (83%) is
          actually visible against it, so the full-width track reads as a
          track, with the fill showing real progress on top of it. */}
      <div className="h-1 bg-border overflow-hidden">
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

function StepTherapy({ outcome, values, onChange, mappingOverride, therapyMeta = {}, isDirectMode = false, sessionMode, setSessionMode, sessionModeTouched, setSessionModeTouched, totalRupees = 0 }) {
  const o = getOutcome(outcome);
  // Prefer DB override (admin-configurable), fall back to static outcome data.
  const therapies = mappingOverride?.length ? mappingOverride : (o?.protocol?.therapies || []);
  const basePrice = parsePrice(o?.pricing?.single?.price);
  const baseDuration = parseInt(String(o?.protocol?.duration || '45'), 10) || 45;
  const hasFloat = values.some((s) => String(s).includes('float'));
  // Any selected therapy priced off a solo/couple durationOptions matrix
  // (Float, Sauna, Red Light, Cold Plunge) — the guest must choose before a
  // real price can be shown (see sessionModeTouched in the parent).
  const sessionModeTherapies = values.filter((slug) => Array.isArray(therapyMeta?.[slug]?.durationOptions) && therapyMeta[slug].durationOptions.length > 0);
  const hasSessionMode = sessionModeTherapies.length > 0;

  // Resolve the true duration for a therapy: static override > DB meta > outcome-level fallback.
  const durationFor = (t) => t.durationMin || therapyMeta[t.slug]?.durationMin || baseDuration;
  // Resolve price: DB `defaultPrice` (source of truth in admin Services) →
  // outcome-level rate × role-multiplier fallback.
  const priceFor = (t) => {
    const dbp = Number(therapyMeta[t.slug]?.defaultPrice) || 0;
    if (dbp > 0) return dbp;
    const role = String(t.role || '').toLowerCase();
    const mult = PRICE_MULTIPLIER[role] ?? 0.5;
    return Math.round(basePrice * mult);
  };

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
  const combinedDuration = selected.reduce((sum, t) => sum + durationFor(t), 0) || baseDuration;
  const combinedPrice    = selected.reduce((sum, t) => sum + priceFor(t), 0) || basePrice;
  const journeyLabel = selected.length === 1
    ? selected[0].label
    : `${selected.length}-therapy ${o?.title?.toLowerCase() || 'wellness'} journey`;

  // ------------------------------------------------------------------
  // Direct-therapy mode UI (customer arrived via /therapies "Book" CTA).
  // Show a single hero card for the pre-selected therapy + optional
  // add-ons underneath. No outcome framing.
  // ------------------------------------------------------------------
  if (isDirectMode) {
    const primary = selected[0] || therapies[0];
    const extras  = therapies.filter((t) => t.slug !== primary?.slug);
    return (
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 1 of 3 · Direct therapy</div>
        <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
          {primary?.label}, <br className="hidden md:block" /><span className="italic">reserved for you.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[600px]">
          You picked a therapy directly &mdash; skip the outcome route. We&rsquo;ll hold a room, plan your visit, and let you add complementary sessions if you want.
        </p>

        {primary && (
          <div className="mt-10 rounded-2xl border border-brand bg-brand-soft p-6 md:p-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-brand font-semibold">Your therapy</div>
                <div className="mt-1.5 font-serif text-[28px] md:text-[32px] leading-tight text-foreground">{primary.label}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">{durationFor(primary)} min &middot; single session</div>
              </div>
              <Link href="/therapies" className="text-[12.5px] font-medium text-brand hover:underline">
                Change therapy &rarr;
              </Link>
            </div>
          </div>
        )}

        {extras.length > 0 && (
          <div className="mt-10">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Add a complementary therapy (optional)</div>
            <div className="mt-3 space-y-3">
              {extras.map((t) => {
                const isSel = values.includes(t.slug);
                return (
                  <button key={t.slug} onClick={() => toggle(t.slug)}
                    type="button"
                    className={cn(
                      'w-full text-left rounded-2xl border p-4 md:p-5 flex items-center gap-4 transition-all',
                      isSel ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:border-foreground/40',
                    )}>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-[19px] md:text-[22px] leading-tight text-foreground">{t.label}</div>
                      <div className="mt-1 text-[12.5px] text-muted-foreground">{durationFor(t)} min &middot; {t.role || 'complementary'}</div>
                    </div>
                    <div className={cn(
                      'h-5 w-5 rounded-[6px] border-2 flex items-center justify-center shrink-0',
                      isSel ? 'border-brand bg-brand' : 'border-border',
                    )}>
                      {isSel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Same journey summary bar as outcome flow */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">Your session</div>
          <div className="font-serif text-[19px] leading-tight tracking-tight text-balance">{journeyLabel}</div>
          <div className="mt-3 flex items-center gap-x-6 gap-y-1.5 flex-wrap text-[13px]">
            <div className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span><span className="font-semibold">{combinedDuration}</span> min total</span></div>
            <div className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-muted-foreground" /><span><span className="font-semibold">{selected.length}</span> therapy{selected.length === 1 ? '' : ' combo'}</span></div>
            <div className="ml-auto font-mono text-[15px] font-semibold">&#x20B9;{combinedPrice.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    );
  }

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
                <div className="mt-1 text-[13px] text-muted-foreground">{`${durationFor(t)} min`}</div>
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

      {/* Session-mode (solo/couple) toggle — any selected therapy priced off
          a durationOptions matrix (Float, Sauna, Red Light, Cold Plunge).
          Decided here, before date & time, since it also affects which
          resources (e.g. couple-capable float tanks) are searched later. */}
      {hasSessionMode && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            Session type
          </div>
          <div className="inline-flex rounded-full border border-border p-0.5 bg-background">
            <button type="button" onClick={() => { setSessionMode('single'); setSessionModeTouched(true); }}
              className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                sessionModeTouched && sessionMode === 'single' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              Solo
            </button>
            <button type="button" onClick={() => { setSessionMode('couple'); setSessionModeTouched(true); }}
              className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                sessionModeTouched && sessionMode === 'couple' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground')}>
              Couple
            </button>
          </div>
          <div className="mt-2 text-[11.5px] text-muted-foreground max-w-[520px] leading-[1.5]">
            {!sessionModeTouched
              ? 'Select solo or couple to see the price for this journey.'
              : hasFloat && sessionModeTherapies.length === 1
                ? (sessionMode === 'couple'
                    ? 'Couple sessions use a couple-capable float tank for two people together. Fewer tanks support couple mode — book early.'
                    : 'Standard float in a solo tank.')
                : (sessionMode === 'couple' ? 'Two people, together in the same room, across your selected therapies.' : 'One person, across your selected therapies.')}
          </div>
        </div>
      )}

      {/* Combined journey summary — updates as therapies are toggled */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">Your journey</div>
        <div className="font-serif text-[19px] leading-tight tracking-tight text-balance">{journeyLabel}</div>
        <div className="mt-3 flex items-center gap-x-6 gap-y-1.5 flex-wrap text-[13px]">
          <div className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span><span className="font-semibold">{combinedDuration}</span> min total</span></div>
          <div className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-muted-foreground" /><span><span className="font-semibold">{selected.length}</span> therapy{selected.length === 1 ? '' : ' combo'}</span></div>
          <div className="ml-auto font-mono text-[15px] font-semibold">
            ₹{(hasSessionMode && !sessionModeTouched ? 0 : totalRupees).toLocaleString('en-IN')}
          </div>
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

function StepSlot({ therapies, therapyMeta, value, onChange, sessionMode, floatDurationMin, setFloatDurationMin, guests, setGuests, children, setChildren, totalRupees = 0, onReorderTherapies }) {
  const days = useMemo(() => {
    // Auto-rollover: if IST wall-clock is past 20:00 (branch close) we hide
    // "today" from the picker and default to tomorrow. TC-1 fix.
    // Uses fixed IST offset (+5:30, no DST). MIN_LEAD_MIN is applied by the
    // scheduling engine downstream so this only affects the calendar strip.
    const now = new Date();
    const istHour = new Date(now.getTime() + 330 * 60000).getUTCHours();
    const branchCloseHour = 20;
    const skipToday = istHour >= branchCloseHour;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    if (skipToday) start.setDate(start.getDate() + 1);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return d;
    });
  }, []);
  const [date, setDate] = useState(value?.date || toIsoDay(days[0]));
  const isMulti = therapies.length > 1;
  const [journeyData, setJourneyData] = useState(null); // full journey response for summary
  const [loading, setLoading] = useState(false);
  const hasFloat = therapies.some((t) => String(t).includes('float'));
  // Preferred-time concierge flow — the primary UX per Aug-05-2026 direction.
  const [preferredTime, setPreferredTime] = useState('08:00');
  const [recommendations, setRecommendations] = useState([]);
  const [recExpanded, setRecExpanded] = useState(false);       // usedWindow > requestedWindow
  const [recLoading, setRecLoading] = useState(false);
  const [recOffset, setRecOffset] = useState(0);
  const [manualMode, setManualMode] = useState(false); // "Choose manually" reveals the old grid
  const [manualPickerMode, setManualPickerMode] = useState(isMulti ? 'auto' : 'manual');

  // Fetch the full journey slot data (just for summary + as fallback in manual mode)
  useEffect(() => {
    if (therapies.length === 0 || !date) return;
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ therapies: therapies.join(','), date });
    if (hasFloat && sessionMode) q.set('sessionMode', sessionMode);
    if (hasFloat && floatDurationMin) q.set('floatDurationMin', String(floatDurationMin));
    if (guests > 1) q.set('guests', String(guests));
    if (children > 0) q.set('children', String(children));
    fetch(`/api/scheduling/slots?${q}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) { setJourneyData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setJourneyData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [therapies, date, sessionMode, floatDurationMin, hasFloat, guests, children]);

  // Fetch top-3 recommendations whenever inputs change.
  useEffect(() => {
    if (therapies.length === 0 || !date || !preferredTime) { setRecommendations([]); return; }
    setRecLoading(true);
    setRecOffset(0);
    const q = new URLSearchParams({
      therapies: therapies.join(','),
      date, preferred: preferredTime, limit: '3', offset: '0', window: '60',
    });
    if (hasFloat && sessionMode) q.set('sessionMode', sessionMode);
    if (hasFloat && floatDurationMin) q.set('floatDurationMin', String(floatDurationMin));
    if (guests > 1) q.set('guests', String(guests));
    if (children > 0) q.set('children', String(children));
    fetch(`/api/scheduling/recommendations?${q}`)
      .then((r) => r.ok ? r.json() : { recommendations: [] })
      .then((d) => {
        setRecommendations(d.recommendations || []);
        setRecExpanded(!!d.expandedWindow);
        setRecLoading(false);
      })
      .catch(() => { setRecommendations([]); setRecExpanded(false); setRecLoading(false); });
  }, [therapies, date, preferredTime, sessionMode, floatDurationMin, hasFloat, guests, children]);

  const loadMore = async () => {
    setRecLoading(true);
    const nextOffset = recOffset + 3;
    const q = new URLSearchParams({
      therapies: therapies.join(','),
      date, preferred: preferredTime, limit: '3', offset: String(nextOffset), window: '60',
    });
    if (hasFloat && sessionMode) q.set('sessionMode', sessionMode);
    if (hasFloat && floatDurationMin) q.set('floatDurationMin', String(floatDurationMin));
    if (guests > 1) q.set('guests', String(guests));
    if (children > 0) q.set('children', String(children));
    try {
      const r = await fetch(`/api/scheduling/recommendations?${q}`);
      const d = await r.json();
      const more = (d.recommendations || []).filter(
        (n) => !recommendations.some((cur) => cur.startIso === n.startIso && cur.orderKey === n.orderKey),
      );
      if (more.length > 0) {
        setRecommendations([...recommendations, ...more]);
        setRecOffset(nextOffset);
      } else {
        // No more available at this offset — try a wider window as a last resort.
        setRecOffset(nextOffset);
      }
    } catch { /* silent */ }
    setRecLoading(false);
  };

  const pickRecommendation = (r) => {
    onChange({
      date,
      time: r.time,
      startIso: r.startIso,
      visitFromIso: r.visitFromIso,
      visitToIso: r.visitToIso,
      plan: r.plan,
    });
  };

  // Instant fallback for "Therapy time" from the (already-loaded) therapy
  // metadata, so the card never flashes "0 min" while the slower
  // /api/scheduling/slots call (buffers + availability) is still in flight —
  // it matches the real total in the common no-duration-override case and is
  // replaced the moment journeyData resolves.
  const metaDurationSum = therapies.reduce((sum, slug) => sum + (Number(therapyMeta?.[slug]?.durationMin) || 0), 0);
  const totalDurationMin = journeyData?.totalDurationMin ?? metaDurationSum;
  const totalVisitMin    = journeyData?.totalVisitMin    || 0;
  const visitStillLoading = loading && journeyData === null;
  const dayHasNoSlots = !loading && !!journeyData && journeyData.groups
    && !journeyData.groups.morning?.length && !journeyData.groups.afternoon?.length && !journeyData.groups.evening?.length;

  // Shared-capacity resources (e.g. the Salt Cave, capacity 7) host multiple
  // independent guests per time slot rather than locking exclusively per
  // booking. Private, exclusive-lock therapies (capacity 1 — Sauna, Red
  // Light, Cold Plunge, Float) are booked one party at a time regardless of
  // headcount and don't consult `guests` in their availability check at all
  // (see isResourceFree in lib/scheduling.js), so they're excluded here —
  // a Salt Cave + Red Light combo should still offer up to 7 guests for the
  // Salt Cave leg. Take the STRICTEST (minimum) cap across only the
  // therapies that ARE shared-capacity, so a Salt Cave + Kids Salt combo
  // still correctly caps at 3.
  const sharedCapTherapies = therapies.filter((slug) => (Number(therapyMeta?.[slug]?.maxCapacity) || 1) > 1);
  const sharedCapacity = sharedCapTherapies.length > 0
    ? Math.min(...sharedCapTherapies.map((slug) => Number(therapyMeta[slug].maxCapacity)))
    : 0;

  // Keep `guests` in range as the selected therapies change — e.g. switching
  // away from a shared-capacity therapy should drop back to 1, and switching
  // to one with a smaller cap should clamp down.
  useEffect(() => {
    if (sharedCapacity <= 1 && guests !== 1) setGuests(1);
    else if (sharedCapacity > 1 && guests > sharedCapacity) setGuests(sharedCapacity);
  }, [sharedCapacity, guests, setGuests]);

  // Children: max 3, and adults + children must still fit the room (e.g.
  // Salt Cave, 7). Drop to 0 entirely when there's no shared-capacity
  // therapy in the journey.
  const maxChildren = sharedCapacity > 1 ? Math.max(0, Math.min(3, sharedCapacity - 1)) : 0;
  useEffect(() => {
    if (maxChildren <= 0 && children !== 0) setChildren(0);
    else if (children > maxChildren) setChildren(maxChildren);
    else if (guests + children > sharedCapacity) setChildren(Math.max(0, sharedCapacity - guests));
  }, [maxChildren, sharedCapacity, guests, children, setChildren]);

  // Precompute time-picker options: every 15 min from 08:00 (centre opens) to 20:00.
  // Float always shows here too — the guest picks any preferred time and the
  // scheduling engine shuffles the journey around it, snapping only Float's
  // own step forward to its next fixed daily time (see FLOAT_ANCHOR_TIMES in
  // lib/scheduling.js); other therapies keep the guest's actual preferred time.
  // On today's date, times already passed are hidden — no point offering
  // 08:00 as a preference at 5:52pm.
  const timeOptions = useMemo(() => {
    const arr = [];
    for (let h = 8; h < 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        arr.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    const istNow = new Date(Date.now() + 330 * 60000);
    const todayIso = istNow.toISOString().slice(0, 10);
    if (date !== todayIso) return arr;
    const roundedMin = Math.ceil(istNow.getUTCMinutes() / 15) * 15;
    const cutoffHour = istNow.getUTCHours() + Math.floor(roundedMin / 60);
    const cutoffMin = roundedMin % 60;
    const cutoff = `${String(cutoffHour).padStart(2, '0')}:${String(cutoffMin).padStart(2, '0')}`;
    return arr.filter((t) => t >= cutoff);
  }, [date]);

  // If the current preferred time has fallen out of today's options (either
  // because the date changed or time has simply moved on), snap forward to
  // the earliest one still offered.
  useEffect(() => {
    if (timeOptions.length && !timeOptions.includes(preferredTime)) {
      setPreferredTime(timeOptions[0]);
    }
  }, [timeOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Step 3 of 4</div>
      <h1 className="mt-2 font-serif text-[36px] md:text-[52px] leading-[1.02] tracking-tight text-balance">
        Plan your <span className="italic">wellness journey.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[560px]">
        Tell us when you&rsquo;d like to arrive. We&rsquo;ll build the perfect itinerary from live resource availability.
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
              const therapyIsShared = (Number(meta.maxCapacity) || 1) > 1;
              return (
                <div key={slug}>
                  <div className="flex items-center justify-between text-[14px]">
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand" /><span className="font-medium">{meta.name}</span></div>
                    <div className="text-[12.5px] text-muted-foreground font-mono">{meta.durationMin} min</div>
                  </div>
                  {/* Guest-count control lives right under ITS OWN therapy — not
                      as a shared control for the whole journey — since it only
                      ever applies to this specific shared-capacity resource
                      (e.g. Salt Cave). Other therapies in the same journey
                      (Float, Sauna, etc.) set their own headcount separately
                      via their solo/couple toggle below. */}
                  {therapyIsShared && (
                    <div className="mt-2 mb-1 ml-6 pl-3 border-l-2 border-brand/20">
                      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span>Capacity: 1&ndash;{sharedCapacity} people per time slot &mdash; you may share with other guests.</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-[12.5px] font-medium">How many adults for {meta.name}?</div>
                        <div className="inline-flex items-center rounded-full border border-border bg-card">
                          <button
                            type="button"
                            aria-label="Fewer guests"
                            disabled={guests <= 1}
                            onClick={() => { setGuests(Math.max(1, guests - 1)); onChange(null); }}
                            className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[15px] font-medium text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                          >&minus;</button>
                          <span className="w-8 text-center font-mono text-[13.5px] font-semibold">{guests}</span>
                          <button
                            type="button"
                            aria-label="More guests"
                            disabled={guests >= sharedCapacity - children}
                            onClick={() => { setGuests(Math.min(sharedCapacity - children, guests + 1)); onChange(null); }}
                            className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[15px] font-medium text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                          >+</button>
                        </div>
                      </div>
                      {maxChildren > 0 && (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[12.5px] font-medium">Children joining?</div>
                            <div className="text-[10.5px] text-muted-foreground">Up to 3 &middot; 1 accompanying adult free with children, each child is charged</div>
                          </div>
                          <div className="inline-flex items-center rounded-full border border-border bg-card shrink-0">
                            <button
                              type="button"
                              aria-label="Fewer children"
                              disabled={children <= 0}
                              onClick={() => { setChildren(Math.max(0, children - 1)); onChange(null); }}
                              className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[15px] font-medium text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                            >&minus;</button>
                            <span className="w-8 text-center font-mono text-[13.5px] font-semibold">{children}</span>
                            <button
                              type="button"
                              aria-label="More children"
                              disabled={children >= maxChildren || guests + children >= sharedCapacity}
                              onClick={() => { setChildren(Math.min(maxChildren, sharedCapacity - guests, children + 1)); onChange(null); }}
                              className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[15px] font-medium text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                            >+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-baseline justify-between flex-wrap gap-1">
            <span className="text-[12.5px] text-muted-foreground">
              Total price{(guests > 1 || children > 0) ? ` for ${guests} adult${guests > 1 ? 's' : ''}${children > 0 ? ` + ${children} child${children > 1 ? 'ren' : ''}` : ''}` : ''}
            </span>
            <span className="font-serif text-[26px] leading-none tracking-tight">
              &#x20B9;{Number(totalRupees || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-[12.5px]">
            <div>
              <div className="text-muted-foreground">Therapy time</div>
              <div className="font-mono font-semibold text-[15px] mt-0.5">{totalDurationMin} min</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated visit</div>
              {visitStillLoading ? (
                <div className="h-[19px] mt-0.5 w-20 rounded bg-muted animate-pulse" />
              ) : (
                <div className="font-mono font-semibold text-[15px] mt-0.5">
                  ~{fmtVisit(totalVisitMin)}
                  <span className="ml-1.5 text-[10.5px] font-sans text-muted-foreground uppercase tracking-[0.14em]">incl. buffers</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Solo/Couple is now chosen on the Therapy step (before this one) —
          see StepTherapy — since it also affects which rooms this step
          searches. sessionMode is still read below to filter results. */}

      {/* Float duration toggle — only if float-therapy is in the journey */}
      {hasFloat && (
        <div className="mt-4">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Float duration</div>
          <div className="inline-flex rounded-full border border-border p-0.5 bg-card">
            <button type="button" onClick={() => { setFloatDurationMin(60); onChange(null); }}
              className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                floatDurationMin === 60 ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              60 min
            </button>
            <button type="button" onClick={() => { setFloatDurationMin(90); onChange(null); }}
              className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                floatDurationMin === 90 ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              90 min
            </button>
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

      {/* -------- CONCIERGE FLOW — Preferred time + Top 3 recommendations -------- */}
      {/* Whole day has no bookable slots (e.g. today's hours are over, closed,
          or fully booked) — say so instead of offering a time picker. */}
      {!manualMode && dayHasNoSlots && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-[13.5px]">
          {journeyData?.closed
            ? 'We are closed on this day. Please choose another date.'
            : 'No slots available on this day. Please choose another date.'}
        </div>
      )}

      {!manualMode && !dayHasNoSlots && (
        <div className="mt-8">
          {/* Preferred time picker */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <label className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold" htmlFor="preferredTime">
              Around what time would you like to start your visit?
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                id="preferredTime"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="h-12 rounded-xl border border-border bg-background px-4 pr-9 text-[16px] font-mono font-semibold focus:outline-none focus:border-foreground/40"
              >
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="text-[12.5px] text-muted-foreground max-w-[420px] leading-[1.5]">
                This is only a preference. We&rsquo;ll recommend the best complete itinerary within &plusmn;60 minutes.
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recLoading && recommendations.length === 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 py-10 text-[12.5px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5 animate-spin" /> Finding the best times for this date&hellip;
            </div>
          )}

          {!recLoading && recommendations.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-[13px]">
              No availability near {preferredTime} on this day. Try a different preferred time, or use
              <button type="button" onClick={() => setManualMode(true)} className="ml-1 underline underline-offset-2 hover:text-foreground">
                the manual picker
              </button>.
            </div>
          )}

          {recommendations.length > 0 && (
            <>
              {/* Stale-while-refreshing — the previous date's cards stay on
                  screen (avoids a jarring blank flash) while a new date's
                  recommendations load in the background, so this banner is
                  the only signal that they're about to change. */}
              {recLoading && (
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 py-2.5 text-[12.5px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 animate-spin" /> Finding the best times for this date&hellip;
                </div>
              )}
              {recExpanded && (
                <div className="mt-4 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-900 dark:text-amber-200 leading-[1.55]">
                  Nothing available around <span className="font-mono font-semibold">{preferredTime}</span> on this day — showing the closest available itineraries instead.
                </div>
              )}
              <div className={cn('mt-6 grid gap-4 transition-opacity', recLoading && 'opacity-40 pointer-events-none')}>
                {recommendations.map((r) => {
                  const isSel = value?.startIso === r.startIso && (value?.plan || []).map((p) => p.therapySlug).join('>') === (r.plan || []).map((p) => p.therapySlug).join('>');
                  return (
                    <button
                      key={r.startIso + (r.orderKey || '')}
                      type="button"
                      onClick={() => pickRecommendation(r)}
                      className={cn(
                        'text-left rounded-2xl border p-5 md:p-6 transition-all',
                        isSel
                          ? 'border-brand bg-brand-soft ring-1 ring-brand'
                          : 'border-border bg-card hover:border-foreground/40 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                            {new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
                          </div>
                          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
                            <div className="font-serif text-[28px] tracking-tight leading-none">{r.time}</div>
                            <span
                              className={cn(
                                'text-[10.5px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full',
                                r.badge === 'best_match'    && 'bg-brand text-white',
                                r.badge === 'fastest_finish'&& 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
                                r.badge === 'least_waiting' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
                              )}
                            >
                              {r.badgeLabel}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            {r.plan.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-[13px]">
                                <div className="h-5 w-5 rounded-full bg-foreground/10 text-foreground text-[10.5px] font-semibold flex items-center justify-center shrink-0">{i + 1}</div>
                                <span className="font-medium">{p.name}</span>
                                <span className="text-muted-foreground font-mono text-[11.5px]">
                                  {fmtTimeRange(p.from, p.to)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {isSel && (
                          <div className="shrink-0 h-6 w-6 rounded-full bg-brand text-white text-[11px] font-semibold flex items-center justify-center">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-3 gap-3 text-[11.5px]">
                        <div>
                          <div className="text-muted-foreground uppercase tracking-[0.12em] text-[10px]">Finishes by</div>
                          <div className="font-mono font-semibold text-[13.5px] mt-0.5">
                            {new Date(r.completionAtIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground uppercase tracking-[0.12em] text-[10px]">Total visit</div>
                          <div className="font-mono font-semibold text-[13.5px] mt-0.5">~{fmtVisit(r.totalVisitMin)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground uppercase tracking-[0.12em] text-[10px]">Waiting</div>
                          <div className="font-mono font-semibold text-[13.5px] mt-0.5">
                            {r.waitingMin > 0 ? `${r.waitingMin} min` : 'None'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={recLoading}
                  className="text-[12.5px] font-medium underline underline-offset-4 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {recLoading ? 'Loading…' : 'Show more recommendations'}
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Or choose manually &rarr;
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* -------- Legacy manual picker (revealed only via "Choose manually") -------- */}
      {manualMode && (
        <>
          <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
            {isMulti ? (
              <div className="inline-flex rounded-full border border-border p-0.5 bg-card">
                <button onClick={() => { setManualPickerMode('auto'); onChange(null); }}
                  className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full flex items-center gap-1.5 transition-all',
                    manualPickerMode === 'auto' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground')}>
                  <Sparkles className="h-3.5 w-3.5" /> Auto-build
                </button>
                <button onClick={() => { setManualPickerMode('manual'); onChange(null); }}
                  className={cn('h-9 px-4 text-[12.5px] font-medium rounded-full transition-all',
                    manualPickerMode === 'manual' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                  Choose each therapy
                </button>
              </div>
            ) : <span />}
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
            >
              &larr; Back to recommendations
            </button>
          </div>

          {loading && (
            <div className="mt-8 text-center py-12 text-muted-foreground text-[13px] flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding available times…
            </div>
          )}

          {!loading && manualPickerMode === 'auto' && (
            <AutoJourneyPicker journeyData={journeyData} date={date} therapyMeta={therapyMeta} value={value} onChange={onChange} />
          )}

          {!loading && manualPickerMode === 'manual' && (
            <ManualJourneyPicker therapies={therapies} therapyMeta={therapyMeta} date={date} value={value} onChange={onChange} onReorder={onReorderTherapies} />
          )}
        </>
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
function ManualJourneyPicker({ therapies, therapyMeta, date, value, onChange, onReorder }) {
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
                  <div className="text-[11.5px] text-muted-foreground">{meta.durationMin} min{cutoff && !locked && <span> &middot; earliest {cutoff}</span>}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Reorder controls — only makes sense when there's >1 therapy. */}
                {onReorder && therapies.length > 1 && (
                  <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
                    <button type="button" title="Move up" disabled={i === 0}
                      onClick={() => onReorder(i, -1)}
                      className="h-7 w-7 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Move down" disabled={i === therapies.length - 1}
                      onClick={() => onReorder(i, +1)}
                      className="h-7 w-7 flex items-center justify-center hover:bg-muted border-l border-border disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {picks[i]?.time && <div className="font-mono text-[13px] font-semibold px-3 h-8 rounded-full bg-brand/10 text-brand inline-flex items-center">{picks[i].time}</div>}
              </div>
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

function StepContact({ outcome, therapy, therapies = [], therapyMeta = {}, slot, contact, setContact, payment, setPayment, submitting, onSubmit, error, canPayOnline, slotConflict, onPickSuggestion, coupon, setCoupon, subtotalInr, guests = 1, children = 0, customerId, branchId, isStaff = false, isDirectMode = false, eligibleMemberships = [], selectedMembershipId = null, onSelectMembership = () => {}, bookingFor = 'self', onChangeBookingFor = () => {}, showBookingForToggle = false, quote = null, walletUseInr = 0, setWalletUseInr = () => {}, walletAvailableInr = 0, giftCardCode = '', setGiftCardCode = () => {}, giftCardPin = '', setGiftCardPin = () => {}, giftCardApplied = null, onSignedIn = () => {}, onGoogleStart = () => {} }) {
  const o = getOutcome(outcome);
  const th = o?.protocol?.therapies?.find((x) => x.slug === therapy);
  const isMulti = therapies.length > 1 && slot?.plan?.length > 1;
  // Paying online requires an account (receipts, refunds, and wallet credit
  // all need to attach to a real customer record) — pay-at-visit (staff
  // only) stays guest-friendly. Gate BEFORE asking for name/phone/email:
  // once signed in, those prefill from the account instead of being typed
  // twice, rather than collecting them first and then hitting a login wall.
  const needsLoginGate = payment === 'online' && !customerId && !isStaff && !selectedMembershipId;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{isDirectMode ? 'Step 3 of 3' : 'Step 4 of 4'}</div>
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
        <form noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
          {needsLoginGate ? (
            <>
              <InlineSignIn
                onSignedIn={onSignedIn} onGoogleStart={onGoogleStart}
                title="Sign in to pay online"
                subtitle="Online payments are tied to your account so we can email your receipt and track it against your bookings."
              />
              <div className="text-[11.5px] text-muted-foreground text-center">
                By confirming, you agree to our <Link href="/legal/terms" className="underline underline-offset-2">terms</Link> &amp; <Link href="/legal/refunds" className="underline underline-offset-2">refund policy</Link>.
              </div>
            </>
          ) : (
          <>
          {/* Book-for-self / Book-for-others toggle. Only shown when we have
              known-customer data to fall back on. */}
          {showBookingForToggle && (
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2.5">Who&rsquo;s this booking for?</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onChangeBookingFor('self')}
                  className={cn(
                    'h-11 rounded-lg text-[13px] font-medium border transition-colors flex items-center justify-center gap-2',
                    bookingFor === 'self'
                      ? 'border-brand bg-brand-soft text-foreground'
                      : 'border-border hover:bg-muted/40 text-muted-foreground',
                  )}>
                  {bookingFor === 'self' && <Check className="h-3.5 w-3.5 text-brand" />}
                  Book for myself
                </button>
                <button type="button" onClick={() => onChangeBookingFor('other')}
                  className={cn(
                    'h-11 rounded-lg text-[13px] font-medium border transition-colors flex items-center justify-center gap-2',
                    bookingFor === 'other'
                      ? 'border-brand bg-brand-soft text-foreground'
                      : 'border-border hover:bg-muted/40 text-muted-foreground',
                  )}>
                  {bookingFor === 'other' && <Check className="h-3.5 w-3.5 text-brand" />}
                  Book for someone else
                </button>
              </div>
              {bookingFor === 'other' && (
                <div className="mt-2.5 text-[11.5px] text-muted-foreground leading-[1.55]">
                  Enter the guest&rsquo;s details below. We&rsquo;ll send the confirmation to their phone / email &mdash; your account is still the booker of record.
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="name" className="block text-[12px] font-medium mb-1.5">
                {bookingFor === 'other' ? 'Guest\u2019s full name' : 'Full name'}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <input id="name" type="text"
                value={contact.name || ''} onChange={(e) => setContact({ ...contact, name: e.target.value, _nameValid: undefined })}
                onBlur={(e) => setContact((c) => ({ ...c, _nameValid: e.target.value.trim().length >= 2 }))}
                placeholder={bookingFor === 'other' ? 'e.g. Ananya Iyer' : undefined}
                className={cn(
                  'w-full h-11 px-3.5 rounded-xl border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40',
                  contact._nameValid === false ? 'border-destructive' : 'border-border',
                )} />
              {contact._nameValid === false && (
                <div className="mt-1 text-[11px] text-destructive">Please enter your name.</div>
              )}
            </div>
            <div>
              <label htmlFor="phone" className="block text-[12px] font-medium mb-1.5">
                {bookingFor === 'other' ? 'Guest\u2019s phone' : 'Phone'}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <input id="phone" type="tel"
                value={contact.phone || ''} onChange={(e) => setContact({ ...contact, phone: e.target.value, _phoneValid: undefined })}
                onBlur={(e) => setContact((c) => ({ ...c, _phoneValid: /^[0-9+\-\s]{7,15}$/.test(e.target.value.trim()) }))}
                placeholder={'+91 \u2026'}
                className={cn(
                  'w-full h-11 px-3.5 rounded-xl border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40',
                  contact._phoneValid === false ? 'border-destructive' : 'border-border',
                )} />
              {contact._phoneValid === false && (
                <div className="mt-1 text-[11px] text-destructive">Please enter a valid phone number.</div>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-[12px] font-medium mb-1.5">
              {bookingFor === 'other' ? 'Guest\u2019s email' : 'Email'}
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <input id="email" type="email"
              value={contact.email || ''} onChange={(e) => setContact({ ...contact, email: e.target.value })}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!v) { setContact((c) => ({ ...c, _emailValid: false })); return; }
                const re = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
                setContact((c) => ({ ...c, _emailValid: !/\.\./.test(v) && !/\s/.test(v) && re.test(v) }));
              }}
              placeholder="you@example.com"
              className={cn(
                'w-full h-11 px-3.5 rounded-xl border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40',
                contact._emailValid === false ? 'border-destructive' : 'border-border',
              )} />
            {contact._emailValid === false && (
              <div className="mt-1 text-[11px] text-destructive">Please enter a valid email address with a domain extension (e.g., name@example.com).</div>
            )}
            {contact._emailValid !== false && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {bookingFor === 'other'
                  ? 'Booking confirmation will be sent to the guest.'
                  : 'Your invoice and confirmation will be sent here.'}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="notes" className="block text-[12px] font-medium mb-1.5">Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea id="notes" rows={3}
              value={contact.notes || ''} onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-[14px] leading-6 focus:outline-none focus:ring-2 focus:ring-brand/40" />
          </div>

          {/* Membership-aware — surface active subscriptions that cover this journey. */}
          {eligibleMemberships.length > 0 && (
            <div>
              <div className="text-[12px] font-medium mb-2 inline-flex items-center gap-2">
                Use my membership
                <span className="text-[10px] uppercase tracking-widest bg-brand/10 text-brand px-1.5 py-0.5 rounded">Saves you paying</span>
              </div>
              <div className="space-y-2">
                {eligibleMemberships.map((entry) => {
                  const sub = entry.subscription || {};
                  const plan = sub.planSnapshot || {};
                  const isSel = selectedMembershipId === sub.id;
                  const willConsume = entry.willConsume || 1;
                  return (
                    <label key={sub.id} className={cn(
                      'rounded-xl border p-3.5 flex items-start gap-3 cursor-pointer transition-colors',
                      isSel ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted/40',
                    )}>
                      <input
                        type="radio"
                        name="membership"
                        checked={isSel}
                        onChange={() => onSelectMembership(sub.id)}
                        className="sr-only"
                      />
                      <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0',
                        isSel ? 'border-brand' : 'border-border')}>
                        {isSel && <span className="h-2 w-2 rounded-full bg-brand" />}
                      </span>
                      <div className="flex-1">
                        <div className="text-[14px] font-medium">{sub.planName || plan.name || 'Membership'}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">
                          {plan.type === 'sessions' ? (
                            <>{sub.sessionsRemaining || 0} sessions remaining &middot; will use {willConsume}</>
                          ) : plan.type === 'unlimited' ? (
                            <>Unlimited access &middot; valid till {new Date(sub.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                          ) : (
                            <>Active till {new Date(sub.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-brand shrink-0">FREE</div>
                    </label>
                  );
                })}
                {/* Explicit opt-out card */}
                <label className={cn(
                  'rounded-xl border p-3.5 flex items-start gap-3 cursor-pointer transition-colors',
                  !selectedMembershipId ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted/40',
                )}>
                  <input
                    type="radio"
                    name="membership"
                    checked={!selectedMembershipId}
                    onChange={() => onSelectMembership(null)}
                    className="sr-only"
                  />
                  <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0',
                    !selectedMembershipId ? 'border-brand' : 'border-border')}>
                    {!selectedMembershipId && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium">Pay normally</div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">Keep sessions on your membership for another day.</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Hide the payment card entirely when a membership is applied — it's a wash. */}
          {selectedMembershipId ? (
            <div className="rounded-xl border border-brand bg-brand-soft p-4">
              <div className="text-[13px] font-medium">Covered by your membership</div>
              <div className="text-[11.5px] text-muted-foreground mt-1">
                One session will be deducted per therapy on confirmation. No card required.
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[12px] font-medium mb-2">Payment</div>
              <div className="space-y-2">
                <label className={cn(
                  'rounded-xl border p-3.5 flex items-start gap-3 cursor-pointer transition-colors',
                  payment === 'online' ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted/40'
                )}>
                  <input type="radio" name="payment" value="online" checked={payment === 'online'} onChange={() => setPayment('online')} className="sr-only" />
                  <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0',
                    payment === 'online' ? 'border-brand' : 'border-border')}>
                    {payment === 'online' && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium flex items-center gap-2">
                      Pay online
                      {!canPayOnline && <span className="text-[10px] uppercase tracking-widest bg-amber-500/15 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded">Setup pending</span>}
                    </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    {canPayOnline
                      ? 'Cards, UPI or netbanking via Razorpay. Secure and encrypted.'
                      : 'Payments are being configured. Your slot will be held once confirmed \u2014 reception will assist with checkout on arrival.'}
                  </div>
                </div>
              </label>

              {isStaff && (
                <label className={cn(
                  'rounded-xl border p-3.5 flex items-start gap-3 cursor-pointer transition-colors',
                  payment === 'at-visit' ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted/40'
                )}>
                  <input type="radio" name="payment" value="at-visit" checked={payment === 'at-visit'} onChange={() => setPayment('at-visit')} className="sr-only" />
                  <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0',
                    payment === 'at-visit' ? 'border-brand' : 'border-border')}>
                    {payment === 'at-visit' && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium flex items-center gap-2">
                      Pay at reception
                      <span className="text-[10px] uppercase tracking-widest bg-brand/10 text-brand px-1.5 py-0.5 rounded">Staff</span>
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      Record the payment offline (card / UPI / cash). Reception will collect on arrival or add it against the booking manually.
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>
          )}

          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-[13px] px-3 py-2">{error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background text-[14.5px] font-semibold hover:bg-foreground/90 disabled:opacity-60 transition-colors">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {selectedMembershipId ? 'Confirming\u2026' : payment === 'online' ? 'Opening secure checkout\u2026' : 'Confirming\u2026'}</>
            ) : (
              <>{selectedMembershipId ? 'Use membership & confirm' : payment === 'online' ? 'Pay & confirm booking' : 'Confirm booking'} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          <div className="text-[11.5px] text-muted-foreground text-center">
            By confirming, you agree to our <Link href="/legal/terms" className="underline underline-offset-2">terms</Link> &amp; <Link href="/legal/refunds" className="underline underline-offset-2">refund policy</Link>.
          </div>
          </>
          )}
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
                {(guests > 1 || children > 0) && <Row label="Guests" value={`${guests} adult${guests > 1 ? 's' : ''}${children > 0 ? ` + ${children} child${children > 1 ? 'ren' : ''}` : ''}`} />}
                <Row label="Branch" value="HSR Layout" />
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-3 text-[13.5px]">
              {!isDirectMode && <Row label="Outcome" value={o?.title} />}
              <Row label="Therapy" value={th?.label || (therapies[0] && therapyMeta[therapies[0]]?.name) || '—'} />
              <Row label="Date"    value={slot ? new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }) : '—'} />
              <Row label="Time"    value={slot?.time || '—'} />
              <Row label="Duration" value={o?.protocol?.duration || (therapies[0] && therapyMeta[therapies[0]]?.durationMin ? `${therapyMeta[therapies[0]].durationMin} min` : '—')} />
              {(guests > 1 || children > 0) && <Row label="Guests" value={`${guests} adult${guests > 1 ? 's' : ''}${children > 0 ? ` + ${children} child${children > 1 ? 'ren' : ''}` : ''}`} />}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border">
            <CouponInput
              subtotalInr={Number(subtotalInr) || 0}
              therapies={therapies}
              customerId={customerId}
              branchId={branchId}
              phone={contact?.phone}
              value={coupon}
              onChange={setCoupon}
            />
          </div>

          {/* Wallet redemption (signed-in customers with a balance) */}
          {walletAvailableInr > 0 && !selectedMembershipId && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-baseline justify-between">
                <label htmlFor="walletUse" className="text-[11.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Wallet balance</label>
                <span className="text-[11.5px] font-mono text-muted-foreground">&#x20B9;{walletAvailableInr.toLocaleString('en-IN')} available</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="walletUse" type="number" inputMode="numeric" min={0} max={walletAvailableInr}
                  value={walletUseInr || ''} placeholder="0"
                  onChange={(e) => setWalletUseInr(Math.min(walletAvailableInr, Math.max(0, Number(e.target.value) || 0)))}
                  className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-[13px] font-mono focus:outline-none focus:border-foreground/40"
                />
                <button type="button" onClick={() => setWalletUseInr(walletAvailableInr)}
                  className="h-10 px-3 rounded-md border border-border text-[11.5px] font-medium hover:bg-muted/40">Use max</button>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Wallet balance can be redeemed in full toward this booking.</div>
            </div>
          )}

          {/* Gift card apply */}
          {!selectedMembershipId && (
            <div className="mt-4 pt-4 border-t border-border">
              <label htmlFor="giftCardCode" className="text-[11.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Gift card</label>
              <div className="mt-2 grid grid-cols-[1fr_92px] gap-2">
                <input
                  id="giftCardCode" type="text" placeholder="SW-XXXX-XXXX"
                  value={giftCardCode}
                  onChange={(e) => setGiftCardCode(e.target.value.toUpperCase().trim())}
                  className="h-10 rounded-md border border-border bg-background px-3 text-[13px] font-mono uppercase focus:outline-none focus:border-foreground/40"
                />
                <input
                  id="giftCardPin" type="text" placeholder="PIN"
                  value={giftCardPin} maxLength={6}
                  onChange={(e) => setGiftCardPin(e.target.value.replace(/\D/g, ''))}
                  className="h-10 rounded-md border border-border bg-background px-3 text-[13px] font-mono focus:outline-none focus:border-foreground/40"
                />
              </div>
              {giftCardApplied?.error && (
                <div className="mt-1 text-[11.5px] text-destructive">Gift card not applied ({giftCardApplied.error.replace(/_/g, ' ')}).</div>
              )}
              {giftCardApplied?.amountInr > 0 && (
                <div className="mt-1 text-[11.5px] text-emerald-700 dark:text-emerald-400">
                  &#x20B9;{Number(giftCardApplied.amountInr).toLocaleString('en-IN')} applied &middot; balance after: &#x20B9;{Number(giftCardApplied.balanceAfter).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          )}

          {/* Full breakdown from the server pricing engine */}
          {quote && (
            <div className="mt-5 pt-4 border-t border-border space-y-1.5 text-[12.5px]">
              <div className="flex items-baseline justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">&#x20B9;{Number(quote.baseSubtotalInr).toLocaleString('en-IN')}</span>
              </div>
              {quote.discounts?.membership && (
                <div className="flex items-baseline justify-between text-brand">
                  <span>Membership &middot; {quote.discounts.membership.planName}</span>
                  <span className="font-mono">&ndash; &#x20B9;{Number(quote.discounts.membership.amountInr).toLocaleString('en-IN')}</span>
                </div>
              )}
              {quote.discounts?.wallet && (
                <div className="flex items-baseline justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Wallet &middot; {quote.discounts.wallet.pointsUsed} pts</span>
                  <span className="font-mono">&ndash; &#x20B9;{Number(quote.discounts.wallet.amountInr).toLocaleString('en-IN')}</span>
                </div>
              )}
              {quote.discounts?.coupon && (
                <div className="flex items-baseline justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Coupon &middot; {quote.discounts.coupon.code}</span>
                  <span className="font-mono">&ndash; &#x20B9;{Number(quote.discounts.coupon.amountInr).toLocaleString('en-IN')}</span>
                </div>
              )}
              {quote.discounts?.giftCard && (
                <div className="flex items-baseline justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Gift card &middot; {quote.discounts.giftCard.code}</span>
                  <span className="font-mono">&ndash; &#x20B9;{Number(quote.discounts.giftCard.amountInr).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-border/60 flex items-baseline justify-between">
            <span className="text-[12.5px] text-muted-foreground">Total (est.)</span>
            <span className="font-serif text-[28px] tracking-tight">
              {selectedMembershipId
                ? <span className="text-brand">FREE</span>
                : quote
                  ? <>&#x20B9;{Number(quote.payableInr).toLocaleString('en-IN')}</>
                  : coupon?.applied
                    ? <>&#x20B9;{Math.max(0, (Number(subtotalInr) || 0) - (Number(coupon.discountInr) || 0)).toLocaleString('en-IN')}</>
                    : <>&#x20B9;{Number(subtotalInr || 0).toLocaleString('en-IN')}</>}
            </span>
          </div>
          {selectedMembershipId && (
            <div className="mt-1 flex items-baseline justify-between text-[11.5px] text-brand">
              <span>Covered by your membership</span>
              <span className="font-mono">1 session/therapy</span>
            </div>
          )}
          {!selectedMembershipId && coupon?.applied && (
            <div className="mt-1 flex items-baseline justify-between text-[11.5px] text-emerald-700 dark:text-emerald-400">
              <span>You saved with {coupon.code}</span>
              <span className="font-mono">&ndash; &#x20B9;{Number(coupon.discountInr).toLocaleString('en-IN')}</span>
            </div>
          )}
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

/** CouponInput
 *  Optimistically validates a coupon code against POST /api/coupons/validate.
 *  Applies if the server says ok; sets a friendly error otherwise. On apply
 *  the parent stores `{ code, discountInr, applied:true }`; on remove, null.
 */
function CouponInput({ subtotalInr, therapies, customerId, branchId, phone, value, onChange }) {
  const [input, setInput] = useState(value?.code || '');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);

  const apply = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input, subtotalInr, therapies, branchId, customerId, phone }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { setErr(j.message || 'Coupon could not be applied.'); onChange(null); return; }
      onChange({ code: j.coupon.code, discountInr: j.discountInr, applied: true });
    } catch { setErr('Could not validate coupon right now.'); }
    finally { setBusy(false); }
  };
  const remove = () => { onChange(null); setInput(''); setErr(null); };

  if (value?.applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-500/5 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">✓</div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-emerald-800 dark:text-emerald-300 truncate">{value.code} applied</div>
            <div className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80">You saved ₹{Number(value.discountInr).toLocaleString('en-IN')}</div>
          </div>
        </div>
        <button type="button" onClick={remove} className="text-[11.5px] text-emerald-800 dark:text-emerald-300 hover:underline shrink-0">Remove</button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-1.5">Coupon code</div>
      <div className="flex items-center gap-2">
        <input value={input} onChange={(e) => { setInput(e.target.value.toUpperCase()); setErr(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          placeholder="ANANYA10"
          className="flex-1 h-9 rounded-md border border-border bg-background font-mono tracking-widest text-[13.5px] px-3 focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button type="button" onClick={apply} disabled={busy || !input}
          className="h-9 px-3 rounded-md text-[12.5px] font-semibold border border-border hover:bg-muted disabled:opacity-40">
          {busy ? '…' : 'Apply'}
        </button>
      </div>
      {err && <div className="mt-1 text-[11.5px] text-red-600">{err}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Client root                                                        */
/* ------------------------------------------------------------------ */

export default function BookingClient({ initialOutcome }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // -----------------------------------------------------------------
  // Direct-therapy mode: `/book?therapy=<slug>` without any outcome.
  // Skips the Outcome step entirely (customer picks a therapy first, then
  // date/time, then contact). Pricing still borrows the primary outcome's
  // single-session rate silently — no separate therapy-price table exists yet.
  // -----------------------------------------------------------------
  const rawTherapyParam    = searchParams.get('therapy');
  const rawOutcomeParam    = searchParams.get('outcome');
  const isDirectTherapyMode = !!rawTherapyParam && !rawOutcomeParam && !initialOutcome;
  const primaryOutcome      = isDirectTherapyMode ? primaryOutcomeForTherapy(rawTherapyParam) : null;

  const initialResolvedOutcome = initialOutcome
    || (isDirectTherapyMode ? primaryOutcome?.slug : null);
  const initialTherapies       = isDirectTherapyMode && rawTherapyParam ? [rawTherapyParam] : [];

  // Direct mode → start at step 0 of a 3-step wizard (Therapy).
  // Normal mode: start at step 1 (Therapy) if outcome came in via SSR, else step 0.
  const [stepIdx, setStepIdx] = useState(
    isDirectTherapyMode ? 0 : (initialResolvedOutcome ? 1 : 0),
  );
  const [outcome, setOutcome]     = useState(initialResolvedOutcome);
  const [therapies, setTherapies] = useState(initialTherapies);
  const steps = isDirectTherapyMode ? STEPS_DIRECT : STEPS;
  const stepId = steps[stepIdx]?.id;
  const [slot, setSlot] = useState(null);
  const [contact, setContact] = useState({});
  const [customerId, setCustomerId] = useState(null);
  const [payment, setPayment] = useState('online');
  // Staff mode — enabled via `?staff=1` on the URL (set by admin's "New booking"
  // launcher). Only staff see the "Pay at reception" option and can skip Razorpay.
  const isStaff = searchParams.get('staff') === '1';
  // Once we detect staff mode, default to "at-visit" so admins don't have to
  // fight the customer-facing Razorpay flow.
  useEffect(() => { if (isStaff) setPayment('at-visit'); }, [isStaff]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [payCfg, setPayCfg] = useState({ configured: false, keyId: null });
  const [outcomeMap, setOutcomeMap] = useState(null); // admin-configured overrides
  const [therapyMeta, setTherapyMeta] = useState({}); // slug → {name, durationMin, ...} from DB
  const [sessionMode, setSessionMode] = useState(initialResolvedOutcome === 'couple-activities' ? 'couple' : 'single'); // float-therapy: single | couple
  // Whether the guest has actively picked solo/couple (vs. just inheriting
  // the 'single' default) — gates the therapy step's price display and its
  // Continue button, since solo/couple prices differ significantly and we
  // don't want to silently assume 'single' for the guest.
  const [sessionModeTouched, setSessionModeTouched] = useState(initialResolvedOutcome === 'couple-activities');
  // Re-require an explicit solo/couple confirmation whenever the therapy
  // selection changes — a different combo can change what solo/couple even
  // applies to, and pricing must never silently carry over a stale choice.
  useEffect(() => {
    if (outcome !== 'couple-activities') setSessionModeTouched(false);
  }, [therapies]); // eslint-disable-line react-hooks/exhaustive-deps
  const [floatDurationMin, setFloatDurationMin] = useState(initialResolvedOutcome === 'couple-activities' ? 90 : 60); // float-therapy: 60 | 90
  const [guests, setGuests] = useState(1); // adult headcount for shared-capacity therapies (e.g. Salt Cave)
  const [children, setChildren] = useState(0); // charged children joining, max 3, 1 free accompanying adult each
  const [coupon, setCoupon] = useState(null);              // { code, discountInr, applied } | null
  // Suggestions surfaced when the confirm step receives a 409 slot_unavailable
  const [slotConflict, setSlotConflict] = useState(null); // { reason, suggestions:[{...}] }
  // Membership-aware booking — eligible active subs for the current therapies.
  // Fetched once we know both `therapies` and the logged-in customer. The
  // customer explicitly picks one via the "Use my membership" toggle in Step 3.
  const [eligibleMemberships, setEligibleMemberships] = useState([]); // [{ subscription, willConsume, perTherapy }]
  const [selectedMembershipId, setSelectedMembershipId] = useState(null);
  // Book-for-self vs book-for-someone-else. When a signed-in / prefilled
  // customer starts the flow we default to "self" and load their contact.
  // Switching to "other" keeps the customer's own data cached so we can
  // instantly restore it — the guest fields start empty for typing.
  const [bookingFor, setBookingFor] = useState('self');
  const [selfContact, setSelfContact] = useState({ name: '', phone: '', email: '' });
  const [otherContact, setOtherContact] = useState({ name: '', phone: '', email: '' });
  // Unified pricing engine state — wallet debit, gift card, and full quote.
  const [walletUseInr, setWalletUseInr] = useState(0);
  const [walletAvailableInr, setWalletAvailableInr] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardPin, setGiftCardPin] = useState('');
  const [giftCardApplied, setGiftCardApplied] = useState(null); // { code, amountInr, balanceAfter } | { error }
  const [quote, setQuote] = useState(null);
  const therapy = therapies[0] || null; // convenience alias

  // Restore the in-progress booking after a Google sign-in round trip (see
  // onGoogleStart below) — the redirect to accounts.google.com and back is
  // a full page load, so this is the one login path that can't stay fully
  // in-place like the WhatsApp OTP flow does. Runs once on mount.
  useEffect(() => {
    if (searchParams.get('resume') !== '1') return;
    let draft;
    try {
      const raw = sessionStorage.getItem('sw_booking_resume');
      if (!raw) return;
      draft = JSON.parse(raw);
      sessionStorage.removeItem('sw_booking_resume');
    } catch { return; }
    if (!draft) return;
    if (draft.outcome !== undefined) setOutcome(draft.outcome);
    if (draft.therapies) setTherapies(draft.therapies);
    if (draft.slot) setSlot(draft.slot);
    if (draft.sessionMode) setSessionMode(draft.sessionMode);
    if (draft.floatDurationMin) setFloatDurationMin(draft.floatDurationMin);
    if (draft.guests) setGuests(draft.guests);
    if (draft.children) setChildren(draft.children);
    if (draft.contact) setContact(draft.contact);
    if (draft.bookingFor) setBookingFor(draft.bookingFor);
    if (draft.payment) setPayment(draft.payment);
    if (draft.stepId) {
      const idx = steps.findIndex((s) => s.id === draft.stepId);
      if (idx >= 0) setStepIdx(idx);
    }
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persists the in-progress booking to sessionStorage, then sends the
  // customer to Google — used only from the "sign in to pay online" gate,
  // since that's a real page navigation (unlike the inline WhatsApp OTP
  // path, which never leaves this page).
  const onGoogleStart = () => {
    try {
      sessionStorage.setItem('sw_booking_resume', JSON.stringify({
        outcome, therapies, slot, sessionMode, floatDurationMin, guests, children, contact, bookingFor, payment, stepId,
      }));
    } catch { /* storage unavailable — Google flow will just land on /account instead */ }
    const returnTo = `${window.location.pathname}?resume=1`;
    window.location.href = `/api/customer/auth/google-start?return=${encodeURIComponent(returnTo)}`;
  };

  // Called by the inline WhatsApp-OTP sign-in once verify-otp succeeds —
  // no navigation involved, so the rest of the form is untouched.
  const onSignedIn = (customer) => {
    setCustomerId(customer.id);
    setSelfContact((prev) => ({ name: prev.name || customer.name || '', phone: prev.phone || customer.phone || '', email: prev.email || '' }));
    setContact((prev) => ({ ...prev, name: prev.name || customer.name || '', phone: prev.phone || customer.phone || '' }));
  };

  // Compute subtotal at component scope so both StepContact (for coupon preview)
  // and submit() can share the same value.
  const totalRupees = useMemo(() => {
    const o = getOutcome(outcome);
    const staticTherapies = o?.protocol?.therapies || [];
    const merged = (outcomeMap?.therapies?.length ? outcomeMap.therapies : staticTherapies);
    const selected = merged.filter((t) => therapies.includes(t.slug));
    // Per-therapy price from the admin Services catalog (defaultPrice on the
    // therapy doc) is the SOURCE OF TRUTH — matches what admin sees. Fall
    // back to the outcome-level rate × role-multiplier only when the therapy
    // hasn't been priced in the catalog yet.
    const basePrice = parsePrice(o?.pricing?.single?.price);
    // Shared-capacity therapies (e.g. Salt Cave, capacity 7) use a tiered
    // per-person group rate — the solo price applies only to a single guest;
    // the moment there's more than 1, EVERY guest pays the lower per-person
    // rate (Salt Therapy: 1 guest = ₹1,600 flat; 3 guests = 3×₹1,200).
    // Private/exclusive-lock therapies (capacity 1, e.g. Float Tank, Sauna)
    // are unaffected — `guests` is always 1 for those.
    const sum = selected.reduce((s, t) => {
      const meta = therapyMeta[t.slug];
      const isShared = (Number(meta?.maxCapacity) || 1) > 1;
      const tieredRate = meta?.additionalGuestPriceInr;
      // Any therapy with a durationOptions matrix (Float's 60/90 min, or a
      // single-duration solo/couple therapy like Sauna/Red Light/Cold
      // Plunge) prices off the selected duration + session mode.
      const options = Array.isArray(meta?.durationOptions) ? meta.durationOptions : null;
      if (options?.length && !isShared) {
        const wantDur = String(t.slug).includes('float') ? Number(floatDurationMin) : Number(meta?.durationMin);
        const opt = options.find((o2) => Number(o2.durationMin) === wantDur) || options[0];
        const p = sessionMode === 'couple' ? opt.priceCouple : opt.priceSingle;
        if (p != null) return s + Number(p);
      }
      const dbPrice = Number(meta?.defaultPrice) || 0;
      if (isShared && (guests > 1 || children > 0)) {
        // Children pay the flat child rate each; exactly ONE accompanying
        // adult is free — mirrors the server-side formula in lib/pricing.js.
        const adultUnitPrice = guests > 1 ? (tieredRate != null ? Number(tieredRate) : dbPrice) : dbPrice;
        const childUnitPrice = meta?.childPriceInr != null ? Number(meta.childPriceInr) : dbPrice;
        const waivedAdults = children > 0 ? Math.min(1, guests) : 0;
        const chargeableAdults = guests - waivedAdults;
        return s + (adultUnitPrice * chargeableAdults) + (childUnitPrice * children);
      }
      if (dbPrice > 0) return s + dbPrice;
      const role = String(t.role || '').toLowerCase();
      const mult = PRICE_MULTIPLIER[role] ?? 0.5;
      return s + Math.round(basePrice * mult);
    }, 0);
    return sum || basePrice || 0;
  }, [outcome, outcomeMap, therapies, therapyMeta, sessionMode, floatDurationMin, guests, children]);

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

  // Load signed-in customer's wallet balance so we can show wallet redemption.
  useEffect(() => {
    if (!customerId) { setWalletAvailableInr(0); return; }
    fetch('/api/customer/wallet')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        // API returns balanceInr pre-converted using the live redeemRate.
        setWalletAvailableInr(Number(d.balanceInr) || 0);
      })
      .catch(() => {});
  }, [customerId]);

  // Real-time pricing quote — debounced. Runs whenever any input the pricing
  // engine cares about changes. Keeps the sidebar breakdown live.
  useEffect(() => {
    if (!therapies.length) { setQuote(null); return; }
    const timer = setTimeout(() => {
      fetch('/api/pricing/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapies: therapies.map((slug) => ({
            slug,
            sessionMode: Array.isArray(therapyMeta[slug]?.durationOptions) && therapyMeta[slug].durationOptions.length > 0 ? sessionMode : undefined,
            durationMin: String(slug).includes('float') ? floatDurationMin : undefined,
          })),
          customerId,
          phone: contact?.phone || null,
          branchId: null,
          membershipSubscriptionId: selectedMembershipId || null,
          walletUseInr: Number(walletUseInr) || 0,
          couponCode:   (coupon?.applied ? coupon.code : null),
          giftCardCode: giftCardCode || null,
          giftCardPin:  giftCardPin  || null,
          guests: Number(guests) || 1,
          children: Number(children) || 0,
        }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((q) => {
          setQuote(q);
          // Surface gift card apply result inline
          if (giftCardCode) {
            const err = (q?.errors || []).find((e) => e.step === 'giftCard');
            if (err) setGiftCardApplied({ error: err.error });
            else if (q?.discounts?.giftCard) setGiftCardApplied({ ...q.discounts.giftCard });
            else setGiftCardApplied(null);
          } else setGiftCardApplied(null);
        })
        .catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [therapies, customerId, contact?.phone, selectedMembershipId, walletUseInr, coupon, giftCardCode, giftCardPin, guests, children, sessionMode, floatDurationMin, therapyMeta]);


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

  // Auto-prefill contact from the logged-in customer session (if any). Query-param
  // values (staff-launched flow) take precedence — we only fill blanks.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/customer/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.customer) return;
        const self = {
          name:  d.customer.name  || '',
          phone: d.customer.phone || '',
          email: d.customer.email || '',
        };
        setSelfContact(self);
        // If the guest is still on "self" (default) and the form is empty,
        // hydrate it. Never clobber a user's own edits.
        setContact((prev) => ({
          ...prev,
          name:  prev.name  || self.name,
          phone: prev.phone || self.phone,
          email: prev.email || self.email,
        }));
        setCustomerId((prev) => prev || d.customer.id || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Membership eligibility — refetch whenever the customer id or the therapy
  // selection changes. Sends the therapy slugs so the server can filter to
  // subscriptions that actually cover the whole journey.
  useEffect(() => {
    if (!customerId || therapies.length === 0) {
      setEligibleMemberships([]);
      setSelectedMembershipId(null);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams();
    qs.set('therapies', therapies.join(','));
    if (slot?.startIso) qs.set('atIso', slot.startIso);
    fetch(`/api/customer/subscriptions/eligible?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : { eligible: [] }))
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d?.eligible) ? d.eligible : [];
        setEligibleMemberships(list);
        // If the user had already ticked one and it no longer qualifies, clear.
        setSelectedMembershipId((prev) => {
          if (!prev) return prev;
          return list.some((x) => x.subscription?.id === prev) ? prev : null;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [customerId, therapies, slot?.startIso]);

  // Auto-select the primary therapy when outcome changes.
  useEffect(() => {
    if (outcome && therapies.length === 0) {
      // Honour ?therapy=slug if it's compatible with the outcome.
      const wanted = searchParams.get('therapy');
      const o = getOutcome(outcome);
      const list = o?.protocol?.therapies || [];
      // Pre-select every therapy in the outcome's journey; guests can untick
      // any they don't want.
      if (list.length) { setTherapies(list.map((x) => x.slug)); return; }
      if (wanted) setTherapies([wanted]);
    }
  }, [outcome, therapies.length, searchParams]);

  // Fetch admin-configured outcome→therapy mapping if any (falls back silently).
  useEffect(() => {
    if (!outcome) return;
    let cancelled = false;
    fetch(`/api/outcome-mapping/${outcome}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setOutcomeMap(d);
        if (isDirectTherapyMode) return;
        const all = Array.isArray(d.therapies) ? d.therapies.map((t) => t.slug).filter(Boolean) : [];
        const pick = Array.isArray(d.defaultSelected) && d.defaultSelected.length > 0 ? d.defaultSelected : all;
        if (pick.length > 0) setTherapies(pick);
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

  // Any selected therapy priced off a solo/couple durationOptions matrix
  // (Float, Sauna, Red Light, Cold Plunge) requires an explicit choice
  // before the guest can move past the therapy step — see sessionModeTouched.
  const hasSessionModeChoice = therapies.some((slug) => Array.isArray(therapyMeta?.[slug]?.durationOptions) && therapyMeta[slug].durationOptions.length > 0);

  const canNext =
    (stepId === 'outcome' && !!outcome) ||
    (stepId === 'therapy' && therapies.length > 0 && (!hasSessionModeChoice || sessionModeTouched)) ||
    (stepId === 'slot'    && !!slot?.date && !!slot?.time) ||
    stepId === 'contact';

  // Give the browser's own back/forward buttons wizard-aware behaviour.
  // Without this, the wizard never touches browser history, so pressing
  // back after clicking through several steps just leaves the page
  // entirely (e.g. back to the homepage) instead of undoing the last step.
  // Each forward step pushes a history entry tagged with its stepIdx;
  // back/forward then just replays those entries via popstate.
  useEffect(() => {
    if (typeof window !== 'undefined') window.history.replaceState({ stepIdx }, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onPopState = (e) => {
      const idx = e.state?.stepIdx;
      if (typeof idx === 'number') setStepIdx(Math.max(0, Math.min(idx, steps.length - 1)));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const next = () => setStepIdx((i) => {
    const n = Math.min(i + 1, steps.length - 1);
    if (typeof window !== 'undefined') window.history.pushState({ stepIdx: n }, '');
    return n;
  });
  // Delegates to the browser's own back navigation so the wizard-step
  // history stack (pushed in `next`) and actual browser back stay in sync
  // instead of drifting apart. At step 0 this button isn't even rendered
  // (see BookingHeader) — it's a plain Link to "/" instead.
  const back = () => { if (typeof window !== 'undefined') window.history.back(); };

  // Toggle helper for the Book-for-self / Book-for-others switch.
  // Preserves whatever the user typed on either side of the toggle so they
  // don't lose data when flipping back.
  const switchBookingFor = (mode) => {
    if (mode === bookingFor) return;
    if (mode === 'self') {
      setOtherContact({
        name:  contact.name  || '',
        phone: contact.phone || '',
        email: contact.email || '',
      });
      setContact((prev) => ({
        ...prev,
        name:  selfContact.name,
        phone: selfContact.phone,
        email: selfContact.email,
      }));
    } else {
      setSelfContact((prev) => ({
        name:  contact.name  || prev.name,
        phone: contact.phone || prev.phone,
        email: contact.email || prev.email,
      }));
      setContact((prev) => ({
        ...prev,
        name:  otherContact.name,
        phone: otherContact.phone,
        email: otherContact.email,
      }));
    }
    setBookingFor(mode);
  };

  // Only surface the toggle when we actually have "self" data available —
  // otherwise it's meaningless. Signed-in customers or query-param flows both
  // qualify.
  const hasSelfData = Boolean(selfContact.name || selfContact.phone || selfContact.email);

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
    // Inline field validation — mirrors each field's own onBlur check, so a
    // field the customer never focused (tabbed past, pasted into the form
    // via autofill, etc.) still gets flagged with the same red-border +
    // message treatment instead of relying on the browser's native popup.
    const nameOk  = (contact.name  || '').trim().length >= 2;
    const phoneOk = /^[0-9+\-\s]{7,15}$/.test((contact.phone || '').trim());
    const emailRe = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
    const emailV  = (contact.email || '').trim();
    const emailOk = !!emailV && !/\.\./.test(emailV) && !/\s/.test(emailV) && emailRe.test(emailV);
    if (!nameOk || !phoneOk || !emailOk) {
      setContact((c) => ({ ...c, _nameValid: nameOk, _phoneValid: phoneOk, _emailValid: emailOk }));
      setError('Please fix the highlighted fields above.');
      return;
    }
    if (therapies.length === 0) { setError('Please pick at least one therapy.'); return; }
    setSubmitting(true);
    try {
      const o = getOutcome(outcome);
      const staticTherapies = o?.protocol?.therapies || [];
      const merged = (outcomeMap?.therapies?.length ? outcomeMap.therapies : staticTherapies);
      const selected = merged.filter((t) => therapies.includes(t.slug));
      const primary = selected.find((t) => String(t.role || '').toLowerCase() === 'primary') || selected[0];
      const usingMembership = !!selectedMembershipId;

      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome, outcomeLabel: o?.title,
          therapy: primary?.slug || null,
          therapyLabel: primary?.label || null,
          therapies: selected.map((t) => ({ slug: t.slug, label: t.label, role: t.role })),
          sessionMode: therapies.some((s) => Array.isArray(therapyMeta[s]?.durationOptions) && therapyMeta[s].durationOptions.length > 0) ? sessionMode : null,
          floatDurationMin: therapies.some((s) => String(s).includes('float')) ? floatDurationMin : null,
          slotDate: slot.date, slotTime: slot.time,
          startAt: slot.startIso || null,
          plan: slot.plan || null,
          duration: o?.protocol?.duration,
          contact,
          // When paying with membership, override payment mode server-side too.
          payment: usingMembership ? 'membership' : payment,
          customerId,
          priceLine: o?.pricing?.single?.price + ' ' + (o?.pricing?.single?.period || ''),
          total: totalRupees,
          couponCode: (!usingMembership && coupon?.applied) ? coupon.code : null,
          membershipSubscriptionId: usingMembership ? selectedMembershipId : null,
          // Unified pricing engine inputs
          walletUseInr: Number(walletUseInr) || 0,
          giftCardCode: giftCardCode || null,
          giftCardPin:  giftCardPin  || null,
          guests: Number(guests) || 1,
          children: Number(children) || 0,
          // Booked-for-other flag — useful for reception + record-keeping.
          // customerId still points at the booker/paying account.
          bookedForOther: bookingFor === 'other',
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
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.error === 'membership_not_eligible') {
          setError(`This membership doesn't cover ${j.therapySlug || 'the selected therapy'} (${j.reason || 'not_eligible'}). Uncheck "Use my membership" or pick a different plan.`);
        } else if (j?.error === 'membership_insufficient_sessions') {
          setError(`Not enough sessions on this membership (have ${j.have}, need ${j.need}). Uncheck "Use my membership" to continue.`);
        } else if (j?.error === 'slot_in_past' || j?.error === 'past_time') {
          setError('This slot is in the past. Please pick a future time.');
        } else if (j?.error === 'invalid_email') {
          setError(j.message || 'Please enter a valid email address with a domain extension (e.g., name@example.com).');
        } else if (j?.error === 'below_min_lead_time' || j?.error === 'same_day_late_cutoff' || j?.error === 'next_day_early_cutoff') {
          setError(j.message || 'This time is no longer available under our booking rules. Please pick another slot.');
        } else if (j?.error === 'login_required_for_online_payment') {
          setError('Please sign in to pay online.');
        } else {
          setError(j?.message || 'This time is no longer available under our booking rules. Please pick another slot.');
        }
        setSubmitting(false);
        return;
      }
      const doc = await r.json();
      setSlotConflict(null);

      // If online payment requested and Razorpay is configured, open Checkout.
      // Skip entirely when the booking was covered by a membership.
      // Use the server-computed payable (accounts for wallet + coupon + giftcard).
      const payableForCheckout = Number(doc?.total) || 0;
      if (!usingMembership && payment === 'online' && payCfg.configured && payableForCheckout > 0) {
        const co = await fetch('/api/payments/create-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: doc.id, amountPaise: Math.round(payableForCheckout * 100), notes: { ref: doc.ref } }),
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
      <BookingHeader stepIdx={stepIdx} onBack={back} steps={steps} />

      <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-28 md:pb-16">
        {stepId === 'outcome' && <StepOutcome value={outcome} onChange={(v) => { setOutcome(v); setTherapies([]); setOutcomeMap(null); const couple = v === 'couple-activities'; setSessionMode(couple ? 'couple' : 'single'); setFloatDurationMin(couple ? 90 : 60); }} />}
        {stepId === 'therapy' && <StepTherapy outcome={outcome} values={therapies} onChange={setTherapies} mappingOverride={outcomeMap?.therapies} therapyMeta={therapyMeta} isDirectMode={isDirectTherapyMode}
          sessionMode={sessionMode} setSessionMode={setSessionMode} sessionModeTouched={sessionModeTouched} setSessionModeTouched={setSessionModeTouched}
          totalRupees={totalRupees} />}
        {stepId === 'slot'    && <StepSlot therapies={therapies} therapyMeta={therapyMeta} value={slot} onChange={setSlot} sessionMode={sessionMode}
          floatDurationMin={floatDurationMin} setFloatDurationMin={setFloatDurationMin} guests={guests} setGuests={setGuests} children={children} setChildren={setChildren} totalRupees={totalRupees}
          onReorderTherapies={(idx, dir) => {
            const arr = [...therapies];
            const j = idx + dir;
            if (j < 0 || j >= arr.length) return;
            [arr[idx], arr[j]] = [arr[j], arr[idx]];
            setTherapies(arr);
            // Any auto/manual picks are now stale — reset so the fresh order
            // triggers a slot re-fetch cleanly.
            setSlot(null);
          }}
        />}
        {stepId === 'contact' && (
          <StepContact
            outcome={outcome} therapy={therapy} slot={slot}
            therapies={therapies} therapyMeta={therapyMeta}
            contact={contact} setContact={setContact}
            payment={payment} setPayment={setPayment}
            canPayOnline={payCfg.configured}
            submitting={submitting} error={error} onSubmit={submit}
            slotConflict={slotConflict}
            coupon={coupon} setCoupon={setCoupon}
            subtotalInr={totalRupees}
            guests={guests}
            children={children}
            customerId={customerId}
            branchId={null}
            isStaff={isStaff}
            isDirectMode={isDirectTherapyMode}
            eligibleMemberships={eligibleMemberships}
            selectedMembershipId={selectedMembershipId}
            onSelectMembership={setSelectedMembershipId}
            bookingFor={bookingFor}
            onChangeBookingFor={switchBookingFor}
            showBookingForToggle={hasSelfData}
            quote={quote}
            walletUseInr={walletUseInr}
            setWalletUseInr={setWalletUseInr}
            walletAvailableInr={walletAvailableInr}
            giftCardCode={giftCardCode}
            setGiftCardCode={setGiftCardCode}
            giftCardPin={giftCardPin}
            setGiftCardPin={setGiftCardPin}
            giftCardApplied={giftCardApplied}
            onSignedIn={onSignedIn}
            onGoogleStart={onGoogleStart}
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

      {/* Sticky footer with primary action — hidden on the final Confirm step */}
      {stepId !== 'contact' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
            <div className="hidden md:block text-[12.5px] text-muted-foreground">
              {stepId === 'outcome' && (outcome ? `→ ${getOutcome(outcome)?.title}` : 'Choose the outcome you want')}
              {stepId === 'therapy' && (therapies.length > 0
                ? `→ ${therapies.length} ${therapies.length === 1 ? 'therapy' : 'therapies'} selected`
                : 'Choose one or more therapies')}
              {stepId === 'slot' && (slot ? `→ ${new Date(slot.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} at ${slot.time}` : 'Pick a date and time')}
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
