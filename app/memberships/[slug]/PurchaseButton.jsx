'use client';

import { useState } from 'react';
import Script from 'next/script';
import { toast } from 'sonner';
import { ArrowRight, Loader2, UserPlus } from 'lucide-react';
import { InlineSignIn } from '@/components/site/inline-sign-in';

// Handles the full purchase flow for a membership plan: sign-in gate (inline,
// same component the booking flow uses), profile completion (name + email,
// required for invoicing), then a real Razorpay Checkout payment verified
// server-side before the subscription is activated.
export default function PurchaseButton({ plan, initialCustomer }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [profileForm, setProfileForm] = useState({ name: initialCustomer?.name || '', email: initialCustomer?.email || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasCompleteProfile = Boolean(customer?.name?.trim()) && Boolean(customer?.email?.trim());

  const onGoogleStart = () => {
    window.location.href = `/api/customer/auth/google-start?return=${encodeURIComponent(window.location.pathname)}`;
  };

  const onSignedIn = (c) => {
    setCustomer(c);
    setProfileForm({ name: c.name || '', email: c.email || '' });
  };

  const saveProfile = async () => {
    const name = profileForm.name.trim();
    const email = profileForm.email.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter your name and a valid email.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/customer/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      setCustomer(j.customer);
    } catch (e) {
      toast.error('Could not save profile. Please try again.');
    } finally { setSavingProfile(false); }
  };

  const purchase = async () => {
    setLoading(true);
    try {
      const orderRes = await fetch('/api/payments/create-membership-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson.error || 'order_failed');

      if (typeof window.Razorpay !== 'function') throw new Error('checkout_not_ready');

      const rzp = new window.Razorpay({
        key: orderJson.keyId,
        amount: orderJson.order.amount,
        currency: orderJson.order.currency,
        order_id: orderJson.order.id,
        name: 'Salt World',
        description: plan.name,
        prefill: { name: customer?.name || '', email: customer?.email || '', contact: customer?.phone || '' },
        theme: { color: '#0f4c3a' },
        handler: async (response) => {
          try {
            const res = await fetch('/api/memberships/purchase', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: plan.id,
                paymentMethod: 'online',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || 'purchase_failed');
            toast.success(`${plan.name} activated!`);
            window.location.assign('/account/memberships');
          } catch (e) {
            toast.error('Payment succeeded but activation failed — please contact us with your payment ID.');
          } finally { setLoading(false); }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.on('payment.failed', () => { toast.error('Payment failed. Please try again.'); setLoading(false); });
      rzp.open();
    } catch (e) {
      toast.error('Could not start payment. Please try again in a moment.');
      setLoading(false);
    }
  };

  if (!customer) {
    return (
      <InlineSignIn
        bare
        onSignedIn={onSignedIn}
        onGoogleStart={onGoogleStart}
        title="Sign in to purchase"
        subtitle="Memberships are tied to a registered customer account so we can hold sessions on your record and issue invoices."
      />
    );
  }

  if (!hasCompleteProfile) {
    return (
      <div>
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          <UserPlus className="h-4 w-4 text-brand" /> Complete your profile
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground">We need your name and email on file before activating a membership (invoice + confirmation).</div>
        <div className="mt-3 space-y-2.5">
          <input
            type="text" placeholder="Full name" value={profileForm.name}
            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:border-foreground/40 transition-colors"
          />
          <input
            type="email" placeholder="Email address" value={profileForm.email}
            onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:border-foreground/40 transition-colors"
          />
          <button
            type="button" onClick={saveProfile} disabled={savingProfile}
            className="w-full h-10 rounded-lg bg-foreground text-background text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-foreground/90 transition-colors"
          >
            {savingProfile ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <>Save & continue</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button
        onClick={purchase}
        disabled={loading}
        className="w-full h-12 px-5 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-60"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <>Get this plan <ArrowRight className="h-4 w-4" /></>}
      </button>
      <div className="mt-3 text-[11.5px] text-muted-foreground leading-[1.55] text-center">
        Prefer to pay at reception? Just call us &mdash; we can activate this offline.
      </div>
    </>
  );
}
