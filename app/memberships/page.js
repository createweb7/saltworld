import Link from 'next/link';
import { ArrowRight, Check, Sparkles, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';
import { getSupabase } from '@/lib/supabase';

export const metadata = {
  title: 'Memberships · Salt World',
  description: 'Unlimited plans and session packs across our five master therapies.',
};

async function loadPlans() {
  const supabase = getSupabase();
  const { data: rows } = await supabase.from('memberships').select('*').eq('active', true);
  const plans = (rows || []).map((r) => ({ ...r.plan, id: r.id, slug: r.slug, name: r.name, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at }));
  plans.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999) || (Number(a.price) || 0) - (Number(b.price) || 0));
  return plans;
}

function formatCurrency(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

export default async function MembershipsIndex() {
  const plans = await loadPlans();
  const unlimited = plans.filter((p) => p.type === 'unlimited');
  const sessions  = plans.filter((p) => p.type === 'sessions');

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-10">
        <div className="max-w-[1080px] mx-auto px-5 md:px-8 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.24em] font-semibold text-muted-foreground">Memberships</div>
          <h1 className="mt-3 font-serif text-[42px] md:text-[64px] leading-[1.02] tracking-tight text-balance">Commit to <em className="italic font-normal">the practice.</em></h1>
          <p className="mt-4 text-[16px] leading-8 text-muted-foreground max-w-[600px] mx-auto">Unlimited access plans and session packages built around your favourite therapies. Freeze anytime, gift a friend, upgrade whenever you’re ready.</p>
        </div>
      </section>

      {unlimited.length > 0 && (
        <section className="py-6">
          <div className="max-w-[1080px] mx-auto px-5 md:px-8">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">Unlimited plans</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {unlimited.map((p, i) => <PlanCard key={p.id} p={p} highlight={i === 2} />)}
            </div>
          </div>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="max-w-[1080px] mx-auto px-5 md:px-8">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">Session packages</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sessions.map((p) => <PlanCard key={p.id} p={p} />)}
            </div>
          </div>
        </section>
      )}

      <section className="py-14 border-t border-border">
        <div className="max-w-[720px] mx-auto px-5 md:px-8">
          <h2 className="font-serif text-[26px] tracking-tight leading-tight">What you get with every plan</h2>
          <ul className="mt-5 space-y-3 text-[14.5px] leading-7">
            <li className="flex items-start gap-3"><Check className="h-4 w-4 mt-1 text-brand shrink-0" /> Freeze once per period at no cost — travel, injury, whatever life brings.</li>
            <li className="flex items-start gap-3"><Check className="h-4 w-4 mt-1 text-brand shrink-0" /> Book online or from the app; sessions auto-apply.</li>
            <li className="flex items-start gap-3"><Check className="h-4 w-4 mt-1 text-brand shrink-0" /> Giftable — hand a plan to someone you love.</li>
            <li className="flex items-start gap-3"><Check className="h-4 w-4 mt-1 text-brand shrink-0" /> Invoices, ledger, and remaining sessions in your account portal.</li>
          </ul>
        </div>
      </section>

      <SiteFooter />
      <StickyBookingBar />
    </div>
  );
}

function PlanCard({ p, highlight }) {
  const dailyLine =
    p.dailyUsageLimit === 0 && p.type === 'unlimited'
      ? 'Unlimited daily' : p.dailyUsageLimit === 1
      ? '1 session / day' : p.dailyUsageLimit > 1
      ? `${p.dailyUsageLimit} sessions / day` : null;

  return (
    <div className={`relative rounded-2xl border p-6 flex flex-col ${highlight ? 'border-brand bg-brand-soft/40' : 'border-border bg-card'}`}>
      {highlight && (
        <div className="absolute -top-2.5 left-6 h-5 px-2.5 rounded-full bg-brand text-white text-[10px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> Most popular
        </div>
      )}
      <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
        {p.type === 'unlimited' ? 'Unlimited' : 'Session pack'}
      </div>
      <h3 className="mt-1 font-serif text-[22px] leading-tight tracking-tight">{p.name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-serif text-[32px] leading-none tracking-tight">{formatCurrency(p.price)}</span>
        {p.gstPercent > 0 && <span className="text-[11px] text-muted-foreground">+{p.gstPercent}% GST</span>}
      </div>
      <ul className="mt-4 space-y-1.5 text-[12.5px] leading-6 text-muted-foreground flex-1">
        {p.type === 'sessions' && p.sessionsIncluded > 0 && (
          <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand shrink-0" /> {p.sessionsIncluded} sessions</li>
        )}
        {p.type === 'unlimited' && (
          <li className="flex items-center gap-2"><InfinityIcon className="h-3.5 w-3.5 text-brand shrink-0" /> Unlimited access</li>
        )}
        <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-brand shrink-0" /> {p.validityDays}-day validity</li>
        {dailyLine && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand shrink-0" /> {dailyLine}</li>}
        {p.applicableTherapies.length === 0 && (
          <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand shrink-0" /> Any therapy</li>
        )}
        {p.applicableTherapies.length > 0 && (
          <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 mt-0.5 text-brand shrink-0" /> <span>Redeemable on {p.applicableTherapies.map((t) => t.replace(/-/g, ' ').replace(/therapy/, '').trim()).join(', ')}</span></li>
        )}
        {p.freezeAllowed && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand shrink-0" /> Freeze anytime</li>}
        {p.giftable && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand shrink-0" /> Giftable</li>}
      </ul>
      <Link href={`/memberships/${p.slug}`}
        className={`mt-5 h-10 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${highlight ? 'bg-brand text-white hover:bg-brand/90' : 'bg-foreground text-background hover:bg-foreground/90'}`}>
        Choose plan <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
