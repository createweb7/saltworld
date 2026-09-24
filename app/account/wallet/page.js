import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wallet as WalletIcon, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { customerBalance, customerHistory, getLoyaltyConfig } from '@/lib/loyalty';
import { getSupabase } from '@/lib/supabase';
import { TopNav, SiteFooter } from '@/components/site/shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wallet · Salt World' };

async function loadWallet(customerId) {
  const [balance, txs, cfg] = await Promise.all([
    customerBalance(customerId),
    customerHistory(customerId, 100),
    getLoyaltyConfig(getSupabase()),
  ]);
  // Wallet stores real rupees directly (redeemRate 1). Kept as a multiplier
  // rather than assuming 1:1 in case it's ever tuned via admin settings.
  const redeemRate = cfg.redeemRate || 1;
  return {
    balanceInr: Math.floor(balance * redeemRate), redeemRate, txs,
    thresholdInr: cfg.bookingEarnThresholdInr, earnInr: cfg.bookingEarnAmountInr, expiryDays: cfg.bookingEarnExpiryDays,
  };
}

const TX_LABEL = {
  booking_earn: 'Wallet credit earned',
  booking_redeem: 'Applied to booking',
  referral_reward: 'Referral reward',
  birthday_bonus: 'Birthday bonus',
  manual_adjustment: 'Admin adjustment',
  refund: 'Refund',
  expiry: 'Credit expired',
};

export default async function WalletPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const { balanceInr, redeemRate, txs, thresholdInr, earnInr, expiryDays } = await loadWallet(customer.id);

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
              <div className="mt-1 font-serif text-[40px] leading-none tracking-tight">₹{balanceInr.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-14">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <h2 className="font-serif text-[22px] tracking-tight leading-none mb-4">Transaction history</h2>
          {txs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13.5px] text-muted-foreground">
              No transactions yet. Book ₹{thresholdInr.toLocaleString('en-IN')} or more in one visit to earn a ₹{earnInr.toLocaleString('en-IN')} wallet credit.
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
                            {credit ? '+' : '−'}₹{Math.floor(Math.abs(t.points || 0) * redeemRate).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">₹{Math.floor((t.balanceAfter || 0) * redeemRate).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 text-[11.5px] text-muted-foreground text-center">
            Pay ₹{thresholdInr.toLocaleString('en-IN')} or more on a single booking to get ₹{earnInr.toLocaleString('en-IN')} added to your wallet, valid for {expiryDays} days.
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
