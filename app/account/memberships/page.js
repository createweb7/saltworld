import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Sparkles, Infinity as InfinityIcon, Snowflake } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getDb } from '@/lib/mongo';
import { TopNav, SiteFooter } from '@/components/site/shell';
import FreezeButton from './FreezeButton';
import UnfreezeButton from './UnfreezeButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Memberships \u00b7 Salt World' };

async function loadMemberships(customerId) {
  const db = await getDb();
  const subs = await db.collection('memberSubscriptions').find({ customerId }).sort({ startAt: -1 }).toArray();
  const withUsage = await Promise.all(subs.map(async (s) => {
    const usage = await db.collection('membership_usage').find({ subscriptionId: s.id }).sort({ consumedAt: -1 }).limit(10).toArray();
    const { _id, ...rest } = s;
    return { ...rest, usage: usage.map(({ _id, ...u }) => u) };
  }));
  return withUsage;
}

function daysLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 86400000));
}

export default async function AccountMembershipsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const subs = await loadMemberships(customer.id);
  const active = subs.filter((s) => s.status === 'active' || s.status === 'frozen' || s.status === 'pending_payment');
  const past   = subs.filter((s) => !active.includes(s));

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-6">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <h1 className="mt-4 font-serif text-[36px] md:text-[46px] leading-none tracking-tight">Memberships</h1>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground max-w-[560px]">Active plans, remaining sessions, and usage history. Sessions auto-apply when you book covered therapies.</p>
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
              <div className="grid gap-4">
                {active.map((s) => <MembershipCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Past</h2>
              <div className="grid gap-4">
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
  const plan = s.planSnapshot || {};
  const remaining = plan.type === 'sessions' ? s.sessionsRemaining : null;
  const dLeft = daysLeft(s.endAt);

  return (
    <div className={`rounded-2xl border border-border p-5 md:p-6 ${muted ? 'bg-muted/30' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{plan.type === 'unlimited' ? 'Unlimited' : plan.type === 'sessions' ? 'Session pack' : plan.type}</div>
          <div className="mt-1 font-serif text-[22px] leading-tight tracking-tight">{s.planName || plan.name}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            Started {new Date(s.startAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {' · '}Ends {new Date(s.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] ${
          s.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : s.status === 'frozen' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
          : s.status === 'pending_payment' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'}`}>{s.status === 'pending_payment' ? 'Payment pending' : s.status}</span>
      </div>

      {s.status === 'pending_payment' && (
        <div className="mt-4 rounded-md border border-amber-300/60 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-500/5 px-3.5 py-2.5 text-[12.5px] leading-6 text-amber-900 dark:text-amber-200">
          Reserved but not yet paid. Please complete the payment at reception (or wait for our team to reach out on WhatsApp) &mdash; sessions can only be booked once this plan is marked <span className="font-semibold">Active</span>.
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-[12px]">
        <div>
          <div className="text-muted-foreground">Days left</div>
          <div className="font-mono font-semibold text-[18px] mt-0.5">{dLeft}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{plan.type === 'sessions' ? 'Sessions used' : 'Daily limit'}</div>
          <div className="font-mono font-semibold text-[18px] mt-0.5">
            {plan.type === 'sessions' ? `${s.sessionsUsed || 0} / ${s.sessionsIncluded || 0}` :
              plan.dailyUsageLimit === 0 ? <InfinityIcon className="h-5 w-5 inline" /> : plan.dailyUsageLimit}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">{plan.type === 'sessions' ? 'Remaining' : 'Perks'}</div>
          <div className="font-mono font-semibold text-[18px] mt-0.5">
            {plan.type === 'sessions' ? (remaining ?? '\u2014') : (plan.benefits?.length || 0)}
          </div>
        </div>
      </div>

      {s.usage?.length > 0 && (
        <details className="mt-4 pt-4 border-t border-border">
          <summary className="text-[11.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground cursor-pointer hover:text-foreground">Usage history {' · '} {s.usage.length} recent</summary>
          <ul className="mt-3 space-y-1.5 text-[12.5px]">
            {s.usage.map((u) => (
              <li key={u.id} className="flex items-center justify-between font-mono">
                <span>{new Date(u.consumedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-muted-foreground">{u.therapySlug ? u.therapySlug.replace(/-/g, ' ') : 'session'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {s.status === 'active' && plan.freezeAllowed && !muted && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11.5px] text-muted-foreground">Away for a while? Freeze and unpause when you return.</div>
          <FreezeButton subscriptionId={s.id} />
        </div>
      )}
      {s.status === 'frozen' && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11.5px] text-muted-foreground">Currently frozen. Unpause anytime to start booking sessions again.</div>
          <UnfreezeButton subscriptionId={s.id} />
        </div>
      )}
    </div>
  );
}
