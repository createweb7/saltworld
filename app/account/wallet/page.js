import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wallet as WalletIcon, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getDb } from '@/lib/mongo';
import { TopNav, SiteFooter } from '@/components/site/shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wallet · Salt World' };

async function loadWallet(customerId) {
  const db = await getDb();
  const [customer, txs] = await Promise.all([
    db.collection('customers').findOne({ id: customerId }),
    db.collection('wallet_transactions').find({ customerId }).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);
  return { balance: customer?.walletBalance || 0, txs: txs.map(({ _id, ...r }) => r) };
}

const TX_LABEL = {
  BOOKING_EARN: 'Loyalty earned',
  REFERRAL_REFEREE: 'Referral reward — signed up via friend',
  REFERRAL_REFERRER: 'Referral reward — friend booked',
  manual_adjustment: 'Admin adjustment',
  WALLET_REDEEM: 'Applied to booking',
  PROMO_CREDIT: 'Promotional credit',
};

export default async function WalletPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const { balance, txs } = await loadWallet(customer.id);

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />

      <section className="pt-32 md:pt-36 pb-6">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <div className="mt-4 flex items-center gap-5 flex-wrap">
            <div className="h-14 w-14 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center">
              <WalletIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Wallet balance</div>
              <div className="mt-1 font-serif text-[40px] leading-none tracking-tight">₹{balance.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-14">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <h2 className="font-serif text-[22px] tracking-tight leading-none mb-4">Transaction history</h2>
          {txs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13.5px] text-muted-foreground">
              No transactions yet. Complete a booking to start earning loyalty points.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold border-b border-border">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => {
                    const credit = (t.points || 0) > 0;
                    return (
                      <tr key={t.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{TX_LABEL[t.type] || t.type}</div>
                          {t.note && <div className="text-[11.5px] text-muted-foreground mt-0.5">{t.note}</div>}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap ${credit ? 'text-emerald-600' : 'text-red-600'}`}>
                          <span className="inline-flex items-center gap-1 justify-end">
                            {credit ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {credit ? '+' : ''}{(t.points || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">₹{(t.balanceAfter || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 text-[11.5px] text-muted-foreground text-center">
            Loyalty credits are earned automatically on completed bookings and referrals. ₹1 = 1 point.
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
