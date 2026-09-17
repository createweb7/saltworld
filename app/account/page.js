import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Calendar, Wallet, Gift, ClipboardList, User as UserIcon, LogOut, Users } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getSupabase } from '@/lib/supabase';
import { toBooking, toSubscription } from '@/lib/db-mappers';
import { customerHistory } from '@/lib/loyalty';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { formatDate } from '@/lib/date';

export const metadata = { title: 'My account · Salt World' };
export const dynamic = 'force-dynamic';

async function loadDashboard(customerId, phone) {
  const supabase = getSupabase();
  let bookingQuery = supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(20);
  // Only widen the match to contact_phone when phone is actually set — a
  // Google-only sign-in has no phone on file, and an empty string would
  // match every booking that ALSO has a blank contact_phone (a lot of old
  // guest/test records), leaking unrelated bookings into this account.
  if (customerId && phone) {
    bookingQuery = bookingQuery.or(`customer_id.eq.${customerId},contact_phone.eq.${phone}`);
  } else if (customerId) {
    bookingQuery = bookingQuery.eq('customer_id', customerId);
  } else if (phone) {
    bookingQuery = bookingQuery.eq('contact_phone', phone);
  } else {
    bookingQuery = bookingQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // no identity to match on
  }
  const [{ data: bookingRows }, { data: subRows }, recentTxs] = await Promise.all([
    bookingQuery,
    customerId ? supabase.from('member_subscriptions').select('*').eq('customer_id', customerId).eq('status', 'active') : Promise.resolve({ data: [] }),
    customerId ? customerHistory(customerId, 3) : Promise.resolve([]),
  ]);
  return {
    bookings: (bookingRows || []).map(toBooking),
    activeSubs: (subRows || []).map(toSubscription),
    recentTxs,
  };
}

export default async function AccountHome() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const { bookings: allBookings, activeSubs, recentTxs } = await loadDashboard(customer.id, customer.phone);

  // Only show bookings that are genuinely settled — a booking record is
  // created up front for online payments, BEFORE the Razorpay checkout
  // actually completes, so an abandoned/failed payment otherwise leaves a
  // "confirmed"-looking booking with nothing actually paid. Membership and
  // pay-at-visit bookings don't go through that gap, so they're unaffected.
  const bookings = allBookings.filter((b) => b.status !== 'cancelled' && (b.payment !== 'online' || b.paymentStatus === 'paid'));

  const today = new Date(new Date().toDateString());
  const upcoming = bookings.filter((b) => b.startAt && new Date(b.startAt) >= today).slice(0, 5);
  const past     = bookings.filter((b) => !upcoming.includes(b)).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-8 border-b border-border">
        <div className="max-w-[1080px] mx-auto px-5 md:px-8 flex items-center gap-5 flex-wrap">
          <div className="h-14 w-14 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center font-serif text-[22px]">
            {(customer.name || customer.phone || 'M').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Welcome back</div>
            <h1 className="mt-0.5 font-serif text-[30px] md:text-[40px] leading-none tracking-tight">{customer.name || 'Member'}</h1>
            <div className="mt-1 text-[13px] text-muted-foreground font-mono">+{customer.phone}</div>
          </div>
          <form action="/api/customer/auth/logout" method="post">
            <button className="h-9 px-3 rounded-md border border-border text-[12.5px] font-medium hover:bg-muted inline-flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="max-w-[1080px] mx-auto px-5 md:px-8 space-y-10">
          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <QuickAction href="/book"                icon={Calendar}      label="Book a session" />
            <QuickAction href="/account/wallet"      icon={Wallet}        label="Wallet & credits" />
            <QuickAction href="/account/memberships" icon={ClipboardList} label="Memberships" />
            <QuickAction href="/account/referrals"   icon={Users}         label="Refer friends" />
            <QuickAction href="/account/giftcards"   icon={Gift}          label="Gift cards" />
          </div>

          {/* Balance + memberships strip */}
          <div className="grid md:grid-cols-3 gap-4">
            <BalanceCard label="Wallet balance" value={`₹${(customer.walletBalance || 0).toLocaleString('en-IN')}`} icon={Wallet} href="/account/wallet" />
            <BalanceCard
              label="Active memberships"
              value={activeSubs.length === 0 ? '—' : `${activeSubs.length}`}
              icon={ClipboardList}
              href="/account/memberships"
              hint={activeSubs.length > 0 ? activeSubs.map((s) => s.membershipName || s.membershipId).join(', ') : 'Explore plans'}
            />
            <BalanceCard
              label="Recent activity"
              value={recentTxs.length > 0 ? `${recentTxs.length} tx` : '—'}
              icon={ArrowRight}
              href="/account/wallet"
              hint={recentTxs.length > 0 ? new Date(recentTxs[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No transactions yet'}
            />
          </div>

          {/* Upcoming */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif text-[24px] leading-none tracking-tight">Upcoming visits</h2>
              <Link href="/book" className="text-[12.5px] hover:underline">Book another <ArrowRight className="h-3 w-3 inline" /></Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13.5px] text-muted-foreground">
                No upcoming visits. <Link href="/book" className="text-foreground underline underline-offset-2">Book your next session</Link>.
              </div>
            ) : (
              <div className="grid gap-3 md:gap-4">
                {upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
              </div>
            )}
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-serif text-[24px] leading-none tracking-tight">Past visits</h2>
              </div>
              <div className="grid gap-3 md:gap-4">
                {past.map((b) => <BookingRow key={b.id} b={b} muted />)}
              </div>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }) {
  return (
    <Link href={href} className="group rounded-xl border border-border bg-card p-4 flex items-center gap-3 hover:border-foreground/30 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-brand/10 text-brand inline-flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[13.5px] font-medium">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

function BalanceCard({ label, value, icon: Icon, href, hint }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-5 hover:border-foreground/30 transition-colors block">
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-serif text-[26px] leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground truncate">{hint}</div>}
    </Link>
  );
}

const STATUS_BADGE = {
  payment_pending: ['Awaiting payment', 'bg-orange-500/10 text-orange-700 dark:text-orange-400'],
};

function BookingRow({ b, muted }) {
  const isoDate = b.startAt ? formatDate(b.startAt) : '';
  const slotTime = b.startAt ? new Date(b.startAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
  const paymentLabel = b.status === 'payment_pending' ? 'Payment not completed'
    : b.payment === 'online' ? 'Paid online via Razorpay' : b.payment === 'membership' ? 'Covered by membership' : 'Pay at visit';
  const [statusLabel, statusCls] = STATUS_BADGE[b.status] || [b.status || 'confirmed', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'];
  return (
    <Link href={`/account/bookings/${b.id}`} className={`rounded-xl border border-border p-4 md:p-5 flex items-center gap-4 flex-wrap hover:border-foreground/30 transition-colors ${muted ? 'bg-muted/30' : 'bg-card'}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Ref · {b.ref}</div>
        <div className="mt-1 font-serif text-[19px] leading-tight tracking-tight">
          {b.outcomeLabel || b.therapyLabel || b.therapy || 'Salt World session'}
        </div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">{isoDate}{slotTime ? ` · ${slotTime}` : ''}{b.schedule?.length > 1 ? ` · ${b.schedule.length} therapies` : ''}</div>
        <div className="mt-1 text-[11.5px] text-muted-foreground">{paymentLabel}{b.paymentId ? ` · ${b.paymentId}` : ''}</div>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {b.total > 0 && <div className="font-mono text-[14px] font-semibold">₹{Number(b.total).toLocaleString('en-IN')}</div>}
        <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold ${statusCls}`}>{statusLabel}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </Link>
  );
}
