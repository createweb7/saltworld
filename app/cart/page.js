'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { getCart, setQty, removeFromCart } from '@/lib/product-cart';
import { cn } from '@/components/ss/utils';

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve();
    const existing = document.getElementById('razorpay-checkout-js');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load payment gateway.')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'razorpay-checkout-js';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load payment gateway.'));
    document.body.appendChild(s);
  });
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', pincode: '' });
  const [placing, setPlacing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    setItems(getCart());
    const onChange = (e) => setItems(e.detail || getCart());
    window.addEventListener('sw-cart-change', onChange);
    return () => window.removeEventListener('sw-cart-change', onChange);
  }, []);

  useEffect(() => {
    fetch('/api/customer/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setCustomer(d?.customer || null))
      .finally(() => setCustomerLoaded(true));
  }, []);

  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const total = subtotal; // free shipping for now

  const validate = () => {
    const errs = {};
    if (!address.line1.trim()) errs.line1 = 'Enter your address';
    if (!address.city.trim()) errs.city = 'Enter your city';
    if (!address.pincode.trim()) errs.pincode = 'Enter your pincode';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const placeOrder = async () => {
    if (!validate()) return;
    setPlacing(true);
    try {
      await loadRazorpayScript();
      const statusRes = await fetch('/api/payments/status').then((r) => r.json());
      if (!statusRes?.configured) throw new Error('Online payment is temporarily unavailable.');

      const createRes = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((it) => ({ productId: it.productId, qty: it.qty })),
          shippingAddress: address,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createJson?.message || (createJson?.error === 'out_of_stock' ? 'One of your items just sold out.' : 'Could not create your order.'));
      }
      const orderRecord = createJson;

      const co = await fetch('/api/payments/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderRecord.id, amountPaise: Math.round(orderRecord.total * 100), notes: { ref: orderRecord.ref } }),
      });
      const coJson = await co.json();
      if (!co.ok) throw new Error('Could not start payment.');

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: coJson.keyId || statusRes.keyId,
          amount: coJson.order.amount,
          currency: coJson.order.currency || 'INR',
          name: 'Salt World',
          description: `Order ${orderRecord.ref}`,
          order_id: coJson.order.id,
          prefill: {
            name: customer?.name || '',
            email: customer?.email || '',
            contact: customer?.phone || '',
          },
          theme: { color: '#0a3838' },
          handler: async (response) => {
            try {
              const v = await fetch('/api/payments/verify-signature', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: orderRecord.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const j = await v.json();
              if (!v.ok || !j?.success) return reject(new Error('Signature verification failed.'));
              resolve();
            } catch (e) { reject(e); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
        });
        rzp.open();
      });

      localStorage.setItem('sw-product-cart-v1', '[]');
      window.dispatchEvent(new CustomEvent('sw-cart-change', { detail: [] }));
      router.push(`/account/orders/${orderRecord.id}`);
    } catch (e) {
      toast.error(e.message || 'Something went wrong.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero={false} />
      <main className="pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[1000px] mx-auto px-5 md:px-8">
          <Link href="/products" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Continue shopping
          </Link>
          <h1 className="mt-4 font-serif text-[32px] md:text-[42px] leading-[1.05] tracking-tight">Your cart</h1>

          {items.length === 0 ? (
            <div className="mt-12 text-center py-16 rounded-2xl border border-border bg-muted/30">
              <ShoppingCart className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-[14px] text-muted-foreground">Your cart is empty.</p>
              <Link href="/products" className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-[13.5px] font-semibold">
                Browse the shop <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-3">
                {items.map((it) => (
                  <div key={it.productId} className="flex items-center gap-4 rounded-xl border border-border p-3.5">
                    <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {it.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{it.name}</div>
                      <div className="mt-1 text-[13px] text-muted-foreground">{formatINR(it.price)} each</div>
                    </div>
                    <div className="flex items-center rounded-full border border-border h-9">
                      <button aria-label="Decrease quantity" onClick={() => setQty(it.productId, it.qty - 1)} className="h-9 w-8 inline-flex items-center justify-center hover:bg-muted rounded-l-full">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-[13px] font-medium">{it.qty}</span>
                      <button aria-label="Increase quantity" onClick={() => setQty(it.productId, it.qty + 1)} className="h-9 w-8 inline-flex items-center justify-center hover:bg-muted rounded-r-full">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="w-20 text-right text-[13.5px] font-semibold">{formatINR(it.price * it.qty)}</div>
                    <button aria-label="Remove" onClick={() => removeFromCart(it.productId)} className="h-8 w-8 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <aside className="rounded-2xl border border-border bg-card p-5 h-fit space-y-5">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Delivery address</div>
                  <div className="space-y-2">
                    <AddrField value={address.line1} onChange={(v) => { setAddress({ ...address, line1: v }); setFieldErrors((e) => ({ ...e, line1: undefined })); }} placeholder="Address line 1" error={fieldErrors.line1} />
                    <input value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} placeholder="Address line 2 (optional)" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
                    <div className="grid grid-cols-2 gap-2 items-start">
                      <AddrField value={address.city} onChange={(v) => { setAddress({ ...address, city: v }); setFieldErrors((e) => ({ ...e, city: undefined })); }} placeholder="City" error={fieldErrors.city} />
                      <input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="State" className="h-10 px-3 rounded-lg border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <AddrField value={address.pincode} onChange={(v) => { setAddress({ ...address, pincode: v }); setFieldErrors((e) => ({ ...e, pincode: undefined })); }} placeholder="Pincode" error={fieldErrors.pincode} />
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(subtotal)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Shipping</span><span>Free</span></div>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-border text-[15px] font-semibold"><span>Total</span><span>{formatINR(total)}</span></div>
                </div>

                {customerLoaded && !customer ? (
                  <Link
                    href={`/account/login?next=${encodeURIComponent('/cart')}`}
                    className="w-full h-11 rounded-full bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    Sign in to checkout <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <button
                    onClick={placeOrder}
                    disabled={placing || !customerLoaded}
                    className="w-full h-11 rounded-full bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {placing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Placing order…</> : <>Pay & place order <ArrowRight className="h-3.5 w-3.5" /></>}
                  </button>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function AddrField({ value, onChange, placeholder, error }) {
  return (
    <div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={cn('w-full h-10 px-3 rounded-lg border bg-background text-[13px] focus:outline-none focus:ring-2',
          error ? 'border-destructive focus:ring-destructive/40' : 'border-border focus:ring-ring')} />
      {error && <div className="mt-1 ml-1 text-[11px] text-destructive">{error}</div>}
    </div>
  );
}
