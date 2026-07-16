import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Calendar, Wallet, Gift, ClipboardList, User as UserIcon, LogOut } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getDb } from '@/lib/mongo';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { formatDate, formatTime } from '@/lib/date';

export const metadata = { title: 'My account · Salt World' };
export const dynamic = 'force-dynamic';

async function loadCustomerBookings(customerId, phone) {
  const db = await getDb();
  const filter = customerId ? { $or: [{ customerId }, { 'contact.phone': phone }] } : { 'contact.phone': phone };
  const docs = await db.collection('bookings').find(filter).sort({ createdAt: -1 }).limit(20).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export default async function AccountHome() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const bookings = await loadCustomerBookings(customer.id, customer.phone);

  const upcoming = bookings.filter((b) => b.slotDate && new Date(b.slotDate) >= new Date(new Date().toDateString()));
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
            <QuickAction href="/book"        icon={Calendar}      label="Book a session" />
            <QuickAction href="/gifts"        icon={Gift}          label="Buy a gift card" />
            <QuickAction href="/memberships" icon={ClipboardList} label="Explore memberships" />
            <QuickAction href="/account/profile" icon={UserIcon}   label="Update profile" />
          </div>

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

          <div>
            <h2 className="font-serif text-[24px] leading-none tracking-tight mb-4">Wallet & memberships</h2>
            <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Wallet balance</div>
                  <div className="font-mono text-[22px] mt-0.5">₹{(customer.walletBalance || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="text-[13px] text-muted-foreground ml-auto">
                Membership sessions & referral rewards land here.
              </div>
            </div>
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="font-serif text-[24px] leading-none tracking-tight mb-4">Past visits</h2>
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

function BookingRow({ b, muted }) {
  const isoDate = b.slotDate ? formatDate(b.slotDate) : '';
  return (
    <div className={`rounded-xl border border-border p-4 md:p-5 flex items-center gap-4 flex-wrap ${muted ? 'bg-muted/30' : 'bg-card'}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Ref · {b.ref}</div>
        <div className="mt-1 font-serif text-[19px] leading-tight tracking-tight">
          {b.outcomeLabel || b.therapyLabel || b.therapy || 'Salt World session'}
        </div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">{isoDate}{b.slotTime ? ` · ${b.slotTime}` : ''}</div>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {b.total > 0 && <div className="font-mono text-[14px] font-semibold">₹{Number(b.total).toLocaleString('en-IN')}</div>}
        <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{b.status || 'confirmed'}</span>
      </div>
    </div>
  );
}
