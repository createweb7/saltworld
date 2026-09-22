import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getSupabase } from '@/lib/supabase';
import { toOrder } from '@/lib/db-mappers';
import { TopNav, SiteFooter } from '@/components/site/shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My orders' };

const STATUS_LABEL = {
  payment_pending: ['Awaiting payment', 'bg-orange-500/10 text-orange-700 dark:text-orange-400'],
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  packed: ['Preparing', 'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
  shipped: ['Shipped', 'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
  delivered: ['Delivered', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground'],
};

export default async function OrdersListPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login?next=%2Faccount%2Forders');
  const supabase = getSupabase();
  const { data: rows } = await supabase.from('orders').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
  const orders = (rows || []).map(toOrder);

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <section className="pt-32 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</Link>
          <h1 className="mt-4 font-serif text-[32px] md:text-[42px] leading-[1.05] tracking-tight">My orders</h1>

          {orders.length === 0 ? (
            <div className="mt-10 text-center py-16 rounded-2xl border border-border bg-muted/30">
              <Package className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-[14px] text-muted-foreground">No orders yet.</p>
              <Link href="/products" className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-[13.5px] font-semibold">Browse the shop</Link>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {orders.map((o) => {
                const [label, cls] = STATUS_LABEL[o.status] || [o.status, 'bg-muted text-muted-foreground'];
                return (
                  <Link key={o.id} href={`/account/orders/${o.id}`} className="rounded-xl border border-border p-4 md:p-5 flex items-center gap-4 flex-wrap hover:border-foreground/30 transition-colors bg-card">
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-[13.5px] font-medium">{o.ref}</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">{o.createdAt && new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.1em] ${cls}`}>{label}</span>
                    <div className="text-[14px] font-semibold">₹{Number(o.total || 0).toLocaleString('en-IN')}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
