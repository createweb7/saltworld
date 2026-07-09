import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb, clean } from '@/lib/mongo';
import { Wordmark } from '@/components/site/shell';
import { Check, Phone, MessageCircle, MapPin, Sparkles } from 'lucide-react';

async function fetchBooking(id) {
  const db = await getDb();
  const doc = await db.collection('bookings').findOne({ id });
  return doc ? clean(doc) : null;
}

export const dynamic = 'force-dynamic';

export const metadata = { title: "You're booked", robots: { index: false } };

export default async function ConfirmPage({ params }) {
  const { id } = await params;
  const b = await fetchBooking(id);
  if (!b) notFound();
  const dateFmt = new Date(b.slotDate + 'T00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
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
            <Field label="Therapy"   value={b.therapyLabel} />
            <Field label="Duration"  value={b.duration || '—'} />
            <Field label="Date"      value={dateFmt} />
            <Field label="Time"      value={b.slotTime} />
            <Field label="Guest"     value={b.contact?.name} />
            <Field label="Payment"   value={b.payment === 'at-visit' ? 'At visit (card / UPI)' : 'Online'} />
          </div>
          <div className="mt-8 pt-6 border-t border-border flex items-baseline justify-between">
            <span className="text-[12.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total (est.)</span>
            <span className="font-serif text-[32px] tracking-tight">{b.priceLine}</span>
          </div>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-3">
          <Advice title="Arrive five minutes early" body="We’ll settle you in with a warm herbal tea. No forms on arrival day." />
          <Advice title="Skip caffeine two hours before" body="Best effect comes from a settled nervous system." />
          <Advice title="Come in what’s comfortable" body="We provide robes and sandals. Lockers on site." />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <a href="https://wa.me/919916019755" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background font-semibold text-[14px] hover:bg-foreground/90 transition-colors">
            <MessageCircle className="h-4 w-4" /> WhatsApp us
          </a>
          <a href="tel:+919916019755" className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-border text-[14px] font-medium hover:bg-muted transition-colors">
            <Phone className="h-4 w-4" /> +91 99160 19755
          </a>
          <a href="https://maps.google.com/?q=Salt+World+HSR+Layout+Bengaluru" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-border text-[14px] font-medium hover:bg-muted transition-colors">
            <MapPin className="h-4 w-4" /> Directions
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
