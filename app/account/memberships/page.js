import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getDb } from '@/lib/mongo';
import { TopNav, SiteFooter } from '@/components/site/shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Memberships · Salt World' };

async function loadMemberships(customerId) {
  const db = await getDb();
  const subs = await db.collection('memberSubscriptions').find({ customerId }).sort({ startAt: -1 }).toArray();
  // For each subscription, count how many sessions have been used (bookings that consumed it).
  const withUsage = await Promise.all(subs.map(async (s) => {
    const used = await db.collection('bookings').countDocuments({
      customerId, membershipSubscriptionId: s.id, status: { $nin: ['cancelled', 'no_show'] },
    });
    const total = Number(s.totalSessions || 0);
    const remaining = total > 0 ? Math.max(total - used, 0) : null;
    const { _id, ...rest } = s;
    return { ...rest, sessionsUsed: used, sessionsRemaining: remaining };
  }));
  return withUsage;
}

export default async function MembershipsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const subs = await loadMemberships(customer.id);
  const active = subs.filter((s) => s.status === 'active');
  const past   = subs.filter((s) => s.status !== 'active');

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-6">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <h1 className="mt-4 font-serif text-[36px] md:text-[46px] leading-none tracking-tight">Memberships</h1>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[560px]">Track your active plans, remaining sessions, and past subscriptions.</p>
        </div>
      </section>

      <section className="pb-14">
        <div className="max-w-[880px] mx-auto px-5 md:px-8 space-y-8">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Active</h2>
            {active.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <div className="text-[14px] font-medium">No active membership</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">Explore plans built around your favourite therapies.</div>
                <Link href="/memberships" className="mt-4 h-10 px-4 rounded-full bg-foreground text-background text-[13px] font-semibold inline-flex items-center gap-1.5">Explore memberships <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {active.map((s) => <MembershipCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Past</h2>
              <div className="grid gap-3">
                {past.map((s) => <MembershipCard key={s.id} s={s} muted />)}
              </div>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function MembershipCard({ s, muted }) {
  return (
    <div className={`rounded-xl border border-border p-5 ${muted ? 'bg-muted/30' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{s.plan || 'Membership'}</div>
          <div className="mt-1 font-serif text-[20px] leading-tight tracking-tight">{s.membershipName || s.membershipId}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            Started {new Date(s.startAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {s.endAt && ` · ends ${new Date(s.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          </div>
        </div>
        <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{s.status}</span>
      </div>
      {s.totalSessions > 0 && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-[12px]">
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="font-mono font-semibold text-[16px] mt-0.5">{s.totalSessions}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Used</div>
            <div className="font-mono font-semibold text-[16px] mt-0.5">{s.sessionsUsed}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Remaining</div>
            <div className="font-mono font-semibold text-[16px] mt-0.5">{s.sessionsRemaining ?? '—'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
