import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { toBookingFull } from '@/lib/db-mappers';
import { Wordmark } from '@/components/site/shell';
import { Check, Phone, MessageCircle, MapPin, Sparkles, Clock } from 'lucide-react';

async function fetchBooking(id) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
  if (!row) return null;
  const booking = await toBookingFull(supabase, row);
  if (booking.schedule?.length) {
    const resourceIds = [...new Set(booking.schedule.map((s) => s.resourceId).filter(Boolean))];
    if (resourceIds.length) {
      const { data: resources } = await supabase.from('resources').select('id, name').in('id', resourceIds);
      const nameById = Object.fromEntries((resources || []).map((r) => [r.id, r.name]));
      booking.schedule = booking.schedule.map((s) => ({ ...s, resourceName: nameById[s.resourceId] || null }));
    }
  }
  return booking;
}

async function fetchBranch(branchId) {
  if (!branchId) return null;
  const supabase = getSupabase();
  const { data: row } = await supabase.from('branches').select('*').eq('id', branchId).maybeSingle();
  if (!row) return null;
  const { data, ...b } = row;
  return { ...data, id: b.id, code: b.code, name: b.name, hours: b.hours };
}

export const dynamic = 'force-dynamic';

export const metadata = { title: "You're booked", robots: { index: false } };

/** Format an ISO date-time as HH:mm in IST (fixed +05:30 offset). */
function fmtIstTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 330 * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** "10:00 – 10:45" style range. */
function fmtIstRange(fromIso, toIso) {
  return `${fmtIstTime(fromIso)} – ${fmtIstTime(toIso)}`;
}

/** Duration in minutes between two ISO instants. */
function durMin(fromIso, toIso) {
  if (!fromIso || !toIso) return 0;
  return Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
}

export default async function ConfirmPage({ params }) {
  const { id } = await params;
  const b = await fetchBooking(id);
  if (!b) notFound();
  const branch = await fetchBranch(b.branchId);
  const dateFmt = b.startAt ? new Date(b.startAt).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  }) : '—';
  const slotTime = b.startAt ? fmtIstTime(b.startAt) : null;

  const schedule = Array.isArray(b.schedule) ? b.schedule : [];
  const therapies = Array.isArray(b.therapies) ? b.therapies : [];
  const isMulti = schedule.length > 1;
  const totalTherapyMin = schedule.reduce((s, x) => s + durMin(x.from, x.to), 0);
  const nameBySlug = Object.fromEntries(therapies.map((t) => [t.slug, t.label || t.name || t.slug]));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1000px] mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <Wordmark />
          <Link href="/" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">Back to home</Link>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 md:px-8 py-16 md:py-24">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/30 text-brand px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold">
          <Check className="h-3 w-3" /> Confirmed
        </div>
        <h1 className="mt-6 font-serif text-[46px] md:text-[76px] leading-[1] tracking-tight text-balance">
          You&rsquo;re booked.<br />
          <span className="italic text-muted-foreground">We&rsquo;ll see you soon.</span>
        </h1>
        <p className="mt-6 text-[16px] leading-8 text-muted-foreground max-w-[540px]">
          A confirmation has been noted against reference <span className="font-mono text-foreground">{b.ref}</span>.
          Bring nothing but yourself. First-visit paperwork is done on arrival.
        </p>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Field label="Reference" value={<span className="font-mono text-[14px]">{b.ref}</span>} />
            <Field label="Outcome"   value={b.outcomeLabel} />
            <Field
              label="Therapy"
              value={
                therapies.length > 1
                  ? `${therapies.length}-therapy journey`
                  : (b.therapyLabel || therapies[0]?.label || '—')
              }
            />
            <Field label="Duration"  value={totalTherapyMin ? `${totalTherapyMin} min` : (b.duration || '—')} />
            <Field label="Date"      value={dateFmt} />
            <Field label="Time"      value={slotTime} />
            <Field label={b.bookedForOther ? 'Guest' : 'Guest'} value={b.contact?.name} />
            <Field label="Payment"   value={
              b.payment === 'at-visit'   ? 'At visit (card / UPI)' :
              b.payment === 'membership' ? `Membership: ${b.membershipApplied?.planName || 'Active plan'}` :
              'Online'
            } />
          </div>
          {b.bookedForOther && (
            <div className="mt-6 rounded-lg border border-brand/30 bg-brand/5 px-3.5 py-2.5 text-[12.5px] text-foreground flex items-start gap-2.5 leading-6">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand" />
              <span>
                This session was booked for <span className="font-semibold">{b.contact?.name || 'a guest'}</span>. We&rsquo;ll send confirmation and reminders to their phone/email, and welcome them at reception under this reference.
              </span>
            </div>
          )}
          <div className="mt-8 pt-6 border-t border-border flex items-baseline justify-between">
            <span className="text-[12.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total (est.)</span>
            <span className="font-serif text-[32px] tracking-tight">
              {b.membershipApplied
                ? <span className="text-brand">FREE</span>
                : b.total ? `\u20B9${Number(b.total).toLocaleString('en-IN')}` : (b.priceLine || '\u2014')}
            </span>
          </div>
          {b.membershipApplied && (
            <div className="mt-3 rounded-lg border border-brand/40 bg-brand/5 px-3.5 py-2.5 text-[12.5px] text-brand">
              {b.membershipApplied.sessionsConsumed || 1} session{(b.membershipApplied.sessionsConsumed || 1) === 1 ? '' : 's'} deducted from &ldquo;{b.membershipApplied.planName}&rdquo;.
            </div>
          )}
        </div>

        {/* Your itinerary — surfaces the auto-allocated room/resource for each therapy. */}
        {schedule.length > 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Your itinerary
                </div>
                <h2 className="mt-1 font-serif text-[24px] leading-tight tracking-tight">
                  {isMulti ? 'Sequenced across your journey' : 'Reserved for you'}
                </h2>
              </div>
              {b.blockedFrom && b.blockedTo && (
                <div className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border">
                  <Clock className="h-3.5 w-3.5" /> Blocked {fmtIstRange(b.blockedFrom, b.blockedTo)}
                </div>
              )}
            </div>
            <ol className="space-y-3">
              {schedule.map((step, i) => (
                <li key={i} className="flex items-start gap-3 md:gap-4">
                  <div className="h-8 w-8 rounded-full bg-brand/10 text-brand text-[13px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 md:gap-6 items-center">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-foreground truncate">
                        {nameBySlug[step.therapySlug] || step.therapySlug}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">
                        {durMin(step.from, step.to)} min
                      </div>
                    </div>
                    <div className="text-[12px] text-muted-foreground md:text-right">
                      <span className="uppercase tracking-[0.14em] font-semibold text-[10.5px] mr-2 text-foreground/50">Room</span>
                      <span className="font-medium text-foreground">{step.resourceName || 'Auto-assigned'}</span>
                    </div>
                    <div className="font-mono text-[13px] font-semibold tracking-tight md:text-right whitespace-nowrap">
                      {fmtIstRange(step.from, step.to)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[11.5px] text-muted-foreground leading-6">
              Rooms are auto-assigned by the scheduling engine so nothing overlaps. Reception may re-assign on arrival if a preferred room opens up.
            </p>
          </div>
        )}

        <div className="mt-10 grid md:grid-cols-3 gap-3">
          <Advice title="Arrive five minutes early" body="We&rsquo;ll settle you in with a warm herbal tea. No forms on arrival day." />
          <Advice title="Skip caffeine two hours before" body="Best effect comes from a settled nervous system." />
          <Advice title="Come in what&rsquo;s comfortable" body="We provide robes and sandals. Lockers on site." />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <a href="https://wa.me/917687878793" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background font-semibold text-[14px] hover:bg-foreground/90 transition-colors">
            <MessageCircle className="h-4 w-4" /> WhatsApp us
          </a>
          <a href="tel:+917687878793" className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-border text-[14px] font-medium hover:bg-muted transition-colors">
            <Phone className="h-4 w-4" /> +91 76878 78793
          </a>
          <a
            href={branch?.mapsUrl || 'https://maps.google.com/?q=Salt+World+HSR+Layout+Bengaluru'}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-border text-[14px] font-medium hover:bg-muted transition-colors"
          >
            <MapPin className="h-4 w-4" /> {branch?.name ? `Directions · ${branch.name}` : 'Directions'}
          </a>
        </div>

        <div className="mt-16 text-center text-[12.5px] text-muted-foreground">
          Need to reschedule or cancel? Reply to your WhatsApp confirmation or call us at least 12 hours before.
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1.5 text-[14.5px] font-medium text-foreground text-pretty">{value || '—'}</div>
    </div>
  );
}

function Advice({ title, body }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-brand font-semibold"><Sparkles className="h-3 w-3" /> Tip</div>
      <div className="mt-2 font-serif text-[19px] leading-tight text-foreground">{title}</div>
      <p className="mt-1.5 text-[13px] text-muted-foreground leading-6 text-pretty">{body}</p>
    </div>
  );
}
