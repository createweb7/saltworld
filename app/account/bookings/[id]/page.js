import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Clock, Download } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getDb } from '@/lib/mongo';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { formatDate } from '@/lib/date';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Booking · Salt World' };

function fmtTimeRange(fromIso, toIso) {
  const f = new Date(fromIso), t = new Date(toIso);
  const shift = (d) => new Date(d.getTime() + 330 * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  const hf = shift(f), ht = shift(t);
  return `${pad(hf.getUTCHours())}:${pad(hf.getUTCMinutes())} – ${pad(ht.getUTCHours())}:${pad(ht.getUTCMinutes())}`;
}

async function loadBooking(id, customer) {
  const db = await getDb();
  const doc = await db.collection('bookings').findOne({
    id,
    $or: [
      { customerId: customer.id },
      { 'contact.phone': customer.phone },
    ],
  });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  const invoice = await db.collection('invoices').findOne({ bookingId: doc.id });
  return { booking: rest, invoice: invoice ? { number: invoice.number, id: invoice.id, total: invoice.total } : null };
}

export default async function BookingDetailPage({ params }) {
  const { id } = await params;
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const data = await loadBooking(id, customer);
  if (!data) notFound();
  const { booking, invoice } = data;
  const isMulti = Array.isArray(booking.schedule) && booking.schedule.length > 1;

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-6">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <div className="mt-4 flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Ref · {booking.ref}</div>
              <h1 className="mt-1 font-serif text-[32px] md:text-[42px] leading-none tracking-tight">{booking.outcomeLabel || 'Wellness journey'}</h1>
              <div className="mt-2 text-[14px] text-muted-foreground">{booking.slotDate && formatDate(booking.slotDate)}{booking.slotTime ? ` · ${booking.slotTime}` : ''}</div>
            </div>
            <span className="inline-flex items-center h-7 px-3 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{booking.status || 'confirmed'}</span>
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8">
        <div className="max-w-[880px] mx-auto px-5 md:px-8 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            {isMulti ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Your itinerary</div>
                <div className="space-y-3">
                  {booking.schedule.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand/10 text-brand text-[13px] font-semibold flex items-center justify-center shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium truncate">{s.resourceName ? s.therapySlug.replace(/-/g, ' ') : s.therapySlug}</div>
                      </div>
                      <div className="font-mono text-[13px] font-semibold">{fmtTimeRange(s.from, s.to)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Session</div>
                <div className="text-[15px] font-medium">{booking.therapyLabel || booking.therapy}</div>
                {booking.blockedFrom && booking.blockedTo && (
                  <div className="mt-1 text-[12.5px] text-muted-foreground font-mono">{fmtTimeRange(booking.blockedFrom, booking.blockedTo)}</div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Contact on file</div>
              <div className="text-[14px]">{booking.contact?.name}</div>
              <div className="text-[13px] text-muted-foreground mt-0.5">{booking.contact?.phone}</div>
              {booking.contact?.email && <div className="text-[13px] text-muted-foreground mt-0.5">{booking.contact.email}</div>}
              {booking.contact?.notes && (
                <div className="mt-3 pt-3 border-t border-border text-[12.5px] text-muted-foreground leading-relaxed whitespace-pre-line">{booking.contact.notes}</div>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 h-fit md:sticky md:top-24 space-y-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total</div>
              <div className="font-serif text-[32px] tracking-tight mt-1">₹{Number(booking.total || 0).toLocaleString('en-IN')}</div>
              <div className="text-[11.5px] text-muted-foreground mt-1 capitalize">{booking.payment === 'online' ? 'Paid online' : 'Pay at visit'}</div>
            </div>
            <div className="pt-3 border-t border-border flex items-start gap-2 text-[12px] text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Salt World, HSR Layout, Bengaluru 560102</span>
            </div>
            {invoice && (
              <Link href={`/api/invoices/${invoice.id}/pdf`} className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium hover:bg-muted inline-flex items-center gap-1.5 w-full justify-center">
                <Download className="h-3.5 w-3.5" /> Invoice {invoice.number}
              </Link>
            )}
            <Link href="/book" className="h-10 rounded-full bg-foreground text-background text-[13.5px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-1.5 w-full justify-center">
              Book another session
            </Link>
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
