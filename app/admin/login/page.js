'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const nextHref = params.get('next') || '/admin/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'login_failed');
      toast.success(`Welcome, ${data.user.name}`);
      router.push(nextHref);
      router.refresh();
    } catch (e) {
      toast.error(e.message === 'invalid_credentials' ? 'Wrong email or password.' : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid md:grid-cols-2">
      {/* Left — form */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[360px]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-foreground text-background flex items-center justify-center text-[12px] font-bold tracking-tight">SW</div>
            <div className="text-[14px] font-semibold tracking-tight">Salt World<span className="align-super text-[0.55em] ml-0.5 opacity-70">BOS</span></div>
          </div>

          <h1 className="mt-10 text-[26px] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">Welcome back. Sign in to the operating system.</p>

          <form onSubmit={submit} className="mt-8 space-y-3">
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-[0.14em]">Email</label>
              <input
                autoFocus
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full h-11 px-3.5 rounded-md border border-input bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-[0.14em]">Password</label>
                <Link href="/admin/forgot" className="text-[11.5px] text-muted-foreground hover:text-foreground underline underline-offset-4">Forgot?</Link>
              </div>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full h-11 px-3.5 rounded-md border border-input bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-md bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-[11.5px] text-muted-foreground">
            Staff access only. If you don&rsquo;t have an account, ask your manager to invite you.
          </div>
        </div>
      </div>

      {/* Right — brand panel */}
      <div className="hidden md:flex relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#003D3A 0%,#005E58 55%,#00A79A 100%)' }}>
        <div className="absolute inset-0 opacity-[0.06]">
          <div className="absolute inset-0" style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
        </div>
        <div className="relative z-10 m-auto max-w-[420px] px-10 text-white">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-white/80">Business Operating System</div>
          <h2 className="mt-6 font-serif text-[42px] leading-[1.02] tracking-tight">
            Every action on the website,<br /><span className="italic">manageable from one place.</span>
          </h2>
          <p className="mt-6 text-white/80 text-[14.5px] leading-7">
            Reception check-ins, bookings, memberships, gift cards, marketing, payments
            &mdash; a single source of truth for Salt World.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-white/85">
            {[
              ['Bookings', 'Live calendar'],
              ['Customers', '360° view'],
              ['Reports',   'Realtime'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[11.5px] font-semibold tracking-tight">{k}</div>
                <div className="text-[11px] text-white/60 mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
