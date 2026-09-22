import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Gift } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getSupabase } from '@/lib/supabase';
import { toGiftcard } from '@/lib/db-mappers';
import { TopNav, SiteFooter } from '@/components/site/shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gifts you’ve sent' };

export default async function SentGiftsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login?next=%2Faccount%2Fgifts');
  const supabase = getSupabase();
  const { data: rows } = await supabase.from('giftcards').select('*').eq('data->>purchasedByCustomerId', customer.id).order('created_at', { ascending: false });
  const gifts = (rows || []).map(toGiftcard);

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <section className="pt-32 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <h1 className="mt-4 font-serif text-[32px] md:text-[42px] leading-[1.05] tracking-tight">Gifts you&rsquo;ve sent</h1>

          {gifts.length === 0 ? (
            <div className="mt-10 text-center py-16 rounded-2xl border border-border bg-muted/30">
              <Gift className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-[14px] text-muted-foreground">You haven&rsquo;t sent any gifts yet.</p>
              <Link href="/gifts" className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-[13.5px] font-semibold">Gift something</Link>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {gifts.map((g) => (
                <Link key={g.id} href={`/account/gifts/${g.id}`} className="rounded-xl border border-border p-4 md:p-5 flex items-center gap-4 flex-wrap hover:border-foreground/30 transition-colors bg-card">
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-[13.5px] font-medium">{g.kind === 'experience' ? `${g.outcomeTitle} — ${(g.therapies || []).map((t) => t.name).join(' + ')}` : 'Gift card'}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{g.to?.name ? `To ${g.to.name}` : 'No recipient yet'} · {g.createdAt && new Date(g.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.1em] bg-muted text-muted-foreground">{g.status === 'payment_pending' ? 'Pending' : g.status}</span>
                  <div className="text-[14px] font-semibold">₹{Number(g.amount || g.balance || 0).toLocaleString('en-IN')}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
