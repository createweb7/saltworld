'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowRight, Loader2, KeyRound, ArrowLeft, Phone, Apple, MessageCircle } from 'lucide-react';
import { Wordmark } from '@/components/site/shell';

const HERO_IMAGE = 'https://images.pexels.com/photos/1559192/pexels-photo-1559192.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1400&w=940';

const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" width="18" height="18" {...props}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

export default function CustomerLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('choice'); // choice | phone | otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (!error) return;
    const messages = {
      google_not_configured: 'Google sign-in isn’t set up yet. Please use WhatsApp instead.',
      google_denied: 'Google sign-in was cancelled.',
      google_state_mismatch: 'Your sign-in session expired. Please try again.',
      account_disabled: 'This account has been disabled. Contact support.',
      google_signin_failed: 'Sign-in failed. Please try again.',
    };
    toast.error(messages[error] || 'Could not sign in with Google.');
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setMode('otp');
      if (j.devOtp) { setDevOtp(j.devOtp); toast.info(`Dev mode — OTP: ${j.devOtp}`); }
      else toast.success('Code sent via WhatsApp');
    } catch (err) {
      toast.error(err.message === 'invalid_phone' ? 'Enter a valid phone number' : err.message === 'otp_throttled' ? 'Please wait a few minutes before requesting another code' : 'Could not send OTP');
    } finally { setLoading(false); }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      toast.success('Signed in');
      window.location.assign('/account');
    } catch (err) {
      toast.error(
        err.message === 'wrong_otp' ? 'Wrong code. Try again.' :
        err.message === 'otp_expired' ? 'Code expired. Please request a new one.' :
        err.message === 'account_disabled' ? 'This account has been disabled. Contact support.' :
        'Could not sign in',
      );
    } finally { setLoading(false); }
  };

  const startGoogle = () => {
    window.location.href = '/api/customer/auth/google-start';
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left column — brand + hero image */}
      <div className="hidden lg:flex relative flex-1 bg-brand-soft overflow-hidden">
        <Image
          src={HERO_IMAGE}
          alt="A moment of stillness at Salt World"
          fill
          sizes="50vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/50" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <Wordmark inverted />
          </Link>
          <div className="max-w-[420px]">
            <div className="text-[10.5px] uppercase tracking-[0.24em] font-semibold text-white/80">Your sanctuary</div>
            <h1 className="mt-3 font-serif text-[40px] xl:text-[54px] leading-[1.05] tracking-tight text-white text-balance">
              A quieter hour, <em className="italic font-normal">waiting for you.</em>
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-white/85 max-w-[380px]">
              Sign in to see your upcoming visits, track membership sessions, and pick up your wellness journey.
            </p>
          </div>
          <div className="text-[11.5px] text-white/75 flex items-center gap-2 flex-wrap">
            <span>© Salt World</span>
            <span className="opacity-40">·</span>
            <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
            <span className="opacity-40">·</span>
            <Link href="/legal/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>

      {/* Right column — form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="px-5 md:px-8 pt-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Salt World
          </Link>
          <div className="lg:hidden"><Wordmark /></div>
        </header>

        <main className="flex-1 flex items-center justify-center px-5 md:px-8 py-10">
          <div className="w-full max-w-[400px]">
            <div className="text-[10.5px] uppercase tracking-[0.24em] font-semibold text-muted-foreground">
              {mode === 'otp' ? 'Verify your number' : 'Member sign-in'}
            </div>
            <h2 className="mt-2 font-serif text-[34px] md:text-[40px] leading-[1.05] tracking-tight text-balance">
              {mode === 'choice' && <>Welcome <em className="italic font-normal">back.</em></>}
              {mode === 'phone'  && <>Your phone, <em className="italic font-normal">please.</em></>}
              {mode === 'otp'    && <>Check your <em className="italic font-normal">WhatsApp.</em></>}
            </h2>
            <p className="mt-3 text-[14px] text-muted-foreground leading-[1.6] max-w-[360px]">
              {mode === 'choice' && 'Sign in to book sessions, track credits, and manage memberships.'}
              {mode === 'phone'  && 'We’ll send a one-time code — no passwords, no fuss.'}
              {mode === 'otp'    && <>Sent a six-digit code to <span className="font-mono">+{phone.replace(/^\+/, '')}</span>. It’s good for five minutes.</>}
            </p>

            {mode === 'choice' && (
              <div className="mt-8 space-y-3">
                <button onClick={startGoogle}
                  className="w-full h-12 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-[14px] font-medium inline-flex items-center justify-center gap-3">
                  <GoogleIcon /> Continue with Google
                </button>
                <button onClick={() => setMode('phone')}
                  className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors text-[14px] font-semibold inline-flex items-center justify-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Continue with WhatsApp
                </button>
                <button disabled title="Coming soon"
                  className="w-full h-12 rounded-xl border border-border bg-muted/40 text-muted-foreground text-[14px] font-medium inline-flex items-center justify-center gap-2 cursor-not-allowed">
                  <Apple className="h-4 w-4" /> Continue with Apple
                  <span className="ml-1 h-5 px-1.5 rounded-full bg-muted text-[9.5px] font-semibold uppercase tracking-[0.14em]">Soon</span>
                </button>

                <div className="pt-4 flex items-center gap-3 text-[11.5px] text-muted-foreground">
                  <div className="flex-1 h-px bg-border"></div>
                  <span>Secured by Salt World</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                <p className="text-[11.5px] text-muted-foreground text-center leading-[1.55]">
                  By continuing you agree to our{' '}
                  <Link href="/legal/terms" className="text-foreground underline underline-offset-2">terms</Link>{' '}and{' '}
                  <Link href="/legal/privacy" className="text-foreground underline underline-offset-2">privacy policy</Link>.
                </p>
              </div>
            )}

            {mode === 'phone' && (
              <form onSubmit={requestOtp} className="mt-8 space-y-4">
                <div>
                  <label htmlFor="phone" className="block text-[11.5px] font-medium mb-1.5 text-muted-foreground">Phone (with country code)</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="phone"
                      autoFocus
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 76878 78793"
                      className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-border bg-background text-[15px] focus:outline-none focus:border-foreground/40 transition-colors"
                      required
                    />
                  </div>
                </div>
                <button disabled={loading || !phone}
                  className="w-full h-12 rounded-xl bg-foreground text-background text-[14px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-foreground/90 transition-colors">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Send code <ArrowRight className="h-4 w-4" /></>}
                </button>
                <button type="button" onClick={() => setMode('choice')} className="w-full h-10 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors">
                  Try a different sign-in method
                </button>
              </form>
            )}

            {mode === 'otp' && (
              <form onSubmit={submitOtp} className="mt-8 space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-[11.5px] font-medium mb-1.5 text-muted-foreground">Six-digit code</label>
                  <input
                    id="otp"
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full h-14 px-4 rounded-xl border border-border bg-background text-[22px] tracking-[0.4em] text-center font-mono focus:outline-none focus:border-foreground/40 transition-colors"
                    required
                  />
                </div>
                {devOtp && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-[11.5px] text-amber-800 dark:text-amber-300 leading-[1.55]">
                    <span className="font-semibold">Dev mode</span> — your OTP is <span className="font-mono font-semibold text-[13px]">{devOtp}</span>. In production this arrives on WhatsApp.
                  </div>
                )}
                <button disabled={loading || otp.length !== 6}
                  className="w-full h-12 rounded-xl bg-foreground text-background text-[14px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-foreground/90 transition-colors">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : <><KeyRound className="h-4 w-4" /> Sign in</>}
                </button>
                <button type="button" onClick={() => { setMode('phone'); setOtp(''); setDevOtp(null); }} className="w-full h-10 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors">
                  Use a different number
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
