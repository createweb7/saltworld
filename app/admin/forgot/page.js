'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/forgot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('forgot_failed');
      setSent(data);
      toast.success('If that email matches an account, a reset link was sent.');
    } catch { toast.error('Something went wrong.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-[380px]">
        <Link href="/admin/login" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <h1 className="mt-6 text-[26px] font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">Enter your account email and we&rsquo;ll send a link to reset your password.</p>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-[0.14em]">Email</label>
            <input
              autoFocus type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full h-11 px-3.5 rounded-md border border-input bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 rounded-md bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
          </button>
        </form>

        {sent?.devLink && (
          <div className="mt-6 rounded-md border border-dashed border-border p-3 text-[12.5px]">
            <div className="text-muted-foreground mb-1">Dev mode — email delivery not yet wired:</div>
            <Link href={sent.devLink} className="text-brand underline underline-offset-4 break-all">{sent.devLink}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
