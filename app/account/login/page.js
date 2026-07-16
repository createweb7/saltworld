'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { Wordmark } from '@/components/site/shell';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(null); // shown in dev mode when WA not configured

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setStep('otp');
      if (j.devOtp) { setDevOtp(j.devOtp); toast.info(`Dev mode — OTP: ${j.devOtp}`); }
      else toast.success('OTP sent via WhatsApp');
    } catch (err) {
      toast.error(err.message === 'invalid_phone' ? 'Enter a valid phone number' : err.message === 'otp_throttled' ? 'Please wait a few minutes before requesting another code' : 'Could not send OTP');
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      toast.success('Signed in');
      // Full-page nav so the httpOnly cookie is in place for the next request.
      window.location.assign('/account');
    } catch (err) {
      toast.error(err.message === 'wrong_otp' ? 'Wrong code. Try again.' : err.message === 'otp_expired' ? 'Code expired. Please request a new one.' : 'Could not sign in');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 md:px-8 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to Salt World</Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-5">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-center mb-8"><Wordmark /></div>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Member sign-in</div>
            <h1 className="mt-1.5 font-serif text-[28px] leading-tight tracking-tight">
              {step === 'phone' ? 'Your phone, please.' : 'Enter the six-digit code.'}
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground leading-[1.55]">
              {step === 'phone'
                ? 'We’ll WhatsApp you a one-time code. No passwords, no fuss.'
                : `We sent a code to +${phone}. It’s good for five minutes.`}
            </p>

            {step === 'phone' ? (
              <form onSubmit={requestOtp} className="mt-6 space-y-3">
                <div>
                  <label className="block text-[11.5px] font-medium mb-1.5">Phone (with country code)</label>
                  <input
                    autoFocus
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 76878 78793"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/40"
                    required
                  />
                </div>
                <button disabled={loading || !phone} className="w-full h-11 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Send code <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="mt-6 space-y-3">
                <div>
                  <label className="block text-[11.5px] font-medium mb-1.5">Six-digit code</label>
                  <input
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-[20px] tracking-[0.4em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand/40"
                    required
                  />
                </div>
                {devOtp && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-400">
                    Dev mode: your OTP is <span className="font-mono font-semibold">{devOtp}</span> (WhatsApp not configured)
                  </div>
                )}
                <button disabled={loading || otp.length !== 6} className="w-full h-11 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : <><KeyRound className="h-4 w-4" /> Sign in</>}
                </button>
                <button type="button" onClick={() => { setStep('phone'); setOtp(''); setDevOtp(null); }} className="w-full h-10 text-[12.5px] text-muted-foreground hover:text-foreground">
                  Use a different number
                </button>
              </form>
            )}
          </div>
          <p className="mt-6 text-[11.5px] text-center text-muted-foreground">
            By continuing you agree to our <Link href="/legal/terms" className="underline underline-offset-2">terms</Link> and <Link href="/legal/privacy" className="underline underline-offset-2">privacy policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
