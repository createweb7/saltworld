import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Truck } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getSupabase } from '@/lib/supabase';
import { toOrder } from '@/lib/db-mappers';
import { TopNav, SiteFooter } from '@/components/site/shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order' };

const STATUS_LABEL = {
  payment_pending: ['Awaiting payment', 'bg-orange-500/10 text-orange-700 dark:text-orange-400'],
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  packed: ['Preparing for dispatch', 'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
  shipped: ['Shipped', 'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
  delivered: ['Delivered', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground'],
};

async function loadOrder(id, customerId) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('orders').select('*').eq('id', id).eq('customer_id', customerId).maybeSingle();
  if (!row) return null;
  const { data: itemRows } = await supabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true });
  const order = toOrder(row);
  order.items = (itemRows || []).map((it) => ({ productId: it.product_id, name: it.name, price: Number(it.price), qty: it.qty }));
  return order;
}

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(`/account/orders/${id}`)}`);
  const order = await loadOrder(id, customer.id);
  if (!order) notFound();
  const [statusLabel, statusCls] = STATUS_LABEL[order.status] || [order.status, 'bg-muted text-muted-foreground'];
  const addr = order.shippingAddress || {};
  const trackingEvents = order.trackingEvents || [];
  const latestTracking = trackingEvents[trackingEvents.length - 1];

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <section className="pt-32 md:pt-36 pb-6">
        <div className="max-w-[880px] mx-auto px-5 md:px-8">
          <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to orders</Link>
          <div className="mt-4 flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Order · {order.ref}</div>
              <h1 className="mt-1 font-serif text-[32px] md:text-[42px] leading-none tracking-tight">Order confirmation</h1>
              <div className="mt-2 text-[14px] text-muted-foreground">{order.createdAt && new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
            <span className={`inline-flex items-center h-7 px-3 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] ${statusCls}`}>{statusLabel}</span>
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8">
        <div className="max-w-[880px] mx-auto px-5 md:px-8 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Items</div>
              <div className="space-y-3">
                {order.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[13.5px]">
                    <span>{it.name} <span className="text-muted-foreground">× {it.qty}</span></span>
                    <span className="font-medium">₹{(it.price * it.qty).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Delivery address</div>
              <div className="text-[13.5px] leading-relaxed">
                {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.pincode}
              </div>
            </div>

            {trackingEvents.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3 flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Tracking</div>
                <div className="space-y-2">
                  {trackingEvents.slice().reverse().map((ev, i) => (
                    <div key={i} className="text-[13px]">
                      <span className="font-medium capitalize">{ev.status}</span>
                      <span className="text-muted-foreground"> · {new Date(ev.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      {ev.trackingUrl && <a href={ev.trackingUrl} target="_blank" rel="noreferrer" className="ml-2 text-brand underline underline-offset-2">Track</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 h-fit md:sticky md:top-24 space-y-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total</div>
              <div className="font-serif text-[32px] tracking-tight mt-1">₹{Number(order.total || 0).toLocaleString('en-IN')}</div>
              <div className="text-[11.5px] text-muted-foreground mt-1">{order.status === 'payment_pending' ? 'Payment incomplete' : 'Paid online'}</div>
            </div>
            <div className="pt-3 border-t border-border flex items-start gap-2 text-[12px] text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Ships from Salt World, HSR Layout, Bengaluru</span>
            </div>
            <Link href="/products" className="h-10 rounded-full bg-foreground text-background text-[13.5px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-1.5 w-full justify-center">
              Continue shopping
            </Link>
          </aside>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
