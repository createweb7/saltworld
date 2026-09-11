import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Clock, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { getSupabase } from '@/lib/supabase';
import { getCurrentCustomer } from '@/lib/customer-auth';
import PurchaseButton from './PurchaseButton';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPlan(slugOrId) {
  const supabase = getSupabase();
  let query = supabase.from('memberships').select('*');
  query = UUID_RE.test(slugOrId) ? query.or(`slug.eq.${slugOrId},id.eq.${slugOrId}`) : query.eq('slug', slugOrId);
  const { data: row } = await query.maybeSingle();
  if (!row) return null;
  return { ...row.plan, id: row.id, slug: row.slug, name: row.name, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await loadPlan(slug);
  if (!p) return { title: 'Not found' };
  return { title: `${p.name} · Salt World`, description: p.description || '' };
}

export default async function PlanDetailPage({ params }) {
  const { slug } = await params;
  const p = await loadPlan(slug);
  if (!p || p.active === false) notFound();

  // Sign-in, profile completion, and payment all happen inline on this page
  // (see PurchaseButton) rather than bouncing the customer to another page \u2014
  // matches the booking flow's treatment.
  const customer = await getCurrentCustomer();

  const inr = (n) => `\u20B9${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-10">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/memberships" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> All memberships</Link>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold bg-brand/10 text-brand uppercase tracking-[0.14em]">{p.type === 'unlimited' ? 'Unlimited' : 'Session pack'}</span>
          </div>
          <h1 className="mt-3 font-serif text-[40px] md:text-[52px] leading-[1.05] tracking-tight text-balance">{p.name}</h1>
          {p.description && <p className="mt-4 text-[16px] leading-8 text-muted-foreground">{p.description}</p>}
        </div>
      </section>

      <section className="pb-14">
        <div className="max-w-[880px] mx-auto px-5 md:px-8 grid md:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Included</h2>
              <ul className="space-y-2 text-[14.5px] leading-7">
                {p.type === 'sessions' && p.sessionsIncluded > 0 && (
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-brand" /> {p.sessionsIncluded} sessions</li>
                )}
                {p.type === 'unlimited' && <li className="flex items-center gap-3"><InfinityIcon className="h-4 w-4 text-brand" /> Unlimited access within validity</li>}
                <li className="flex items-center gap-3"><Clock className="h-4 w-4 text-brand" /> {p.validityDays}-day validity</li>
                {p.dailyUsageLimit > 0 && <li className="flex items-center gap-3"><Check className="h-4 w-4 text-brand" /> {p.dailyUsageLimit} session{p.dailyUsageLimit > 1 ? 's' : ''} per day</li>}
                {p.applicableTherapies.length === 0
                  ? <li className="flex items-center gap-3"><Check className="h-4 w-4 text-brand" /> Redeemable on any therapy</li>
                  : <li className="flex items-start gap-3"><Check className="h-4 w-4 mt-1 text-brand" /> <span>Redeemable on {p.applicableTherapies.map((t) => t.replace(/-/g, ' ')).join(', ')}</span></li>}
                {p.freezeAllowed && <li className="flex items-center gap-3"><Check className="h-4 w-4 text-brand" /> Freeze anytime</li>}
                {p.giftable && <li className="flex items-center gap-3"><Check className="h-4 w-4 text-brand" /> Giftable</li>}
              </ul>
            </div>

            {(p.benefits || []).length > 0 && (
              <div>
                <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">Member perks</h2>
                <ul className="space-y-2 text-[14.5px] leading-7">
                  {p.benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-brand" /> {b.label || b.code}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 text-[11.5px] text-muted-foreground leading-[1.55]">
              <span className="font-medium text-foreground">Refund policy:</span> {p.refundPolicy === 'no_refund' ? 'Non-refundable once activated.' : p.refundPolicy}
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-card p-6 h-fit md:sticky md:top-24">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Total</div>
            <div className="mt-1 font-serif text-[36px] leading-none tracking-tight">{inr(p.price)}</div>
            <div className="text-[11.5px] text-muted-foreground mt-1">Includes {p.gstPercent}% GST</div>
            <div className="mt-5 pt-5 border-t border-border">
              <PurchaseButton
                plan={{ id: p.id, name: p.name, price: p.price }}
                initialCustomer={customer ? { id: customer.id, name: customer.name || '', email: customer.email || '', phone: customer.phone || '' } : null}
              />
            </div>
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
