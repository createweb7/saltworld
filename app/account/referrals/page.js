import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Copy, Share2, MessageCircle, Mail, Sparkles, Users, Award, IndianRupee } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { issueReferralCode, referralStats } from '@/lib/loyalty';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { formatDate } from '@/lib/date';
import ShareButtons from './ShareButtons';

export const metadata = { title: 'My referrals · Salt World' };
export const dynamic = 'force-dynamic';

export default async function ReferralsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  await issueReferralCode(customer.id).catch(() => {});
  const stats = await referralStats(customer.id);
  const shareLink = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/book?ref=${stats.code?.code || ''}`;

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <section className="pt-28 md:pt-32 pb-6 border-b border-border">
        <div className="max-w-[900px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <div className="mt-4 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Refer &amp; earn</div>
          <h1 className="mt-2 font-serif text-[38px] md:text-[52px] leading-none tracking-tight text-balance">
            Share what changed <span className="italic">your week.</span>
          </h1>
          <p className="mt-4 text-[15px] md:text-[16px] leading-[1.55] text-muted-foreground max-w-[560px]">
            Every friend who books their first session with your code gets <span className="font-semibold text-foreground">{stats.code?.refereeReward || 500} points off</span>. You get <span className="font-semibold text-foreground">{stats.code?.referrerReward || 500} points</span> in your wallet the moment their session confirms.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="max-w-[900px] mx-auto px-5 md:px-8 space-y-8">
          <div className="rounded-2xl border-2 border-brand/40 bg-brand/5 p-6 md:p-8">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">Your unique code</div>
            <div className="font-mono text-[42px] md:text-[56px] tracking-[0.1em] font-semibold text-brand break-all">{stats.code?.code || 'issuing…'}</div>
            {stats.code?.code && <ShareButtons code={stats.code.code} shareLink={shareLink} />}
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <StatCard icon={Users}       label="Friends booked"  value={stats.referrals.length} />
            <StatCard icon={Award}       label="Points earned"   value={stats.totalEarned.toLocaleString('en-IN')} />
            <StatCard icon={IndianRupee} label="Revenue shared"  value={`₹${stats.revenue.toLocaleString('en-IN')}`} />
          </div>

          <div>
            <h2 className="font-serif text-[22px] md:text-[26px] leading-none tracking-tight mb-4">Referral history</h2>
            {stats.referrals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13.5px] text-muted-foreground">
                No one has booked with your code yet. Share it with the first person you’d want beside you in the salt room.
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden bg-card">
                {stats.referrals.map((r, i) => (
                  <div key={r.id} className={`flex items-center gap-4 p-4 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <div className="h-9 w-9 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center"><Sparkles className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium">Booking {r.bookingRef}</div>
                      <div className="text-[11.5px] text-muted-foreground">{formatDate(r.createdAt)} · ₹{Number(r.totalInr).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[15px] font-semibold">+{r.referrerReward} pts</div>
                      <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-400">Rewarded</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">How it works</div>
            <ol className="space-y-2 text-[13.5px] leading-[1.55]">
              <li><span className="font-semibold">1.</span> Share your unique code with a friend.</li>
              <li><span className="font-semibold">2.</span> They enter it when booking their first session.</li>
              <li><span className="font-semibold">3.</span> The moment their booking confirms, both wallets are credited.</li>
              <li><span className="font-semibold">4.</span> Redeem points in full on any future booking.</li>
            </ol>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-3 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-[22px] md:text-[26px] leading-none tracking-tight">{value}</div>
    </div>
  );
}
