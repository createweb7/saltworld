'use client';

// Reusable inline sign-in panel — used anywhere a customer needs to be
// signed in to complete a paid action (booking checkout, membership
// purchase, …) without losing whatever they'd already filled in. WhatsApp
// OTP is fully same-page (fetch calls, no navigation); Google still requires
// a real redirect, so callers pass `onGoogleStart` to handle that (typically
// persisting anything worth resuming, then navigating to
// /api/customer/auth/google-start?return=<path-to-bounce-back-to>).
//
// NOTE: deliberately <div>s, not <form>s, in the phone/otp steps — if this
// renders inside a caller's own <form>, a nested <form> would be invalid
// HTML (browsers merge the inner form's fields into the outer one, so an
// inner "submit" button would silently trigger the OUTER form instead of
// these handlers). Buttons are explicitly type="button" and call the
// handlers directly; Enter in the inputs is wired manually.

import { useState } from 'react';
import { Loader2, KeyRound, LogIn, MessageCircle, Phone } from 'lucide-react';

// WhatsApp OTP sign-in needs a real provider (Meta WhatsApp Cloud API —
// business verification + an approved OTP template) that isn't set up yet.
// Flip this back on once WHATSAPP_CLOUD_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID
// are configured — see lib/whatsapp.js.
export const WHATSAPP_LOGIN_ENABLED = false;

export const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" width="16" height="16" {...props}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

export function InlineSignIn({ onSignedIn, onGoogleStart, title = 'Sign in to continue', subtitle = 'Signing in lets us email your receipt and track this against your account.' }) {
  const [mode, setMode] = useState('choice'); // choice | phone | otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(null);
  const [err, setErr] = useState(null);

  const requestOtp = async () => {
    if (loading || !phone) return;
    setErr(null); setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setMode('otp');
      if (j.devOtp) setDevOtp(j.devOtp);
    } catch (e2) {
      setErr(
        e2.message === 'invalid_phone' ? 'Enter a valid phone number' :
        e2.message === 'otp_throttled' ? 'Please wait a few minutes before requesting another code' :
        e2.message === 'otp_delivery_not_configured' ? 'WhatsApp sign-in isn’t set up yet. Please use Google instead.' :
        'Could not send OTP',
      );
    } finally { setLoading(false); }
  };

  const submitOtp = async () => {
    if (loading || otp.length !== 6) return;
    setErr(null); setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      onSignedIn(j.customer);
    } catch (e2) {
      setErr(
        e2.message === 'wrong_otp' ? 'Wrong code. Try again.' :
        e2.message === 'otp_expired' ? 'Code expired. Please request a new one.' :
        e2.message === 'account_disabled' ? 'This account has been disabled. Contact support.' :
        'Could not sign in',
      );
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[13.5px] font-medium">
        <LogIn className="h-4 w-4 text-brand" /> {title}
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground">{subtitle}</div>

      {mode === 'choice' && (
        <div className="mt-3 space-y-2">
          <button type="button" onClick={onGoogleStart}
            className="w-full h-10 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors text-[13px] font-semibold inline-flex items-center justify-center gap-2">
            <GoogleIcon /> Continue with Google
          </button>
          {WHATSAPP_LOGIN_ENABLED && (
            <button type="button" onClick={() => setMode('phone')}
              className="w-full h-10 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-[13px] font-medium inline-flex items-center justify-center gap-2">
              <MessageCircle className="h-3.5 w-3.5" /> Continue with WhatsApp
            </button>
          )}
        </div>
      )}

      {mode === 'phone' && (
        <div className="mt-3 space-y-2.5">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); requestOtp(); } }}
              placeholder="+91 76878 78793"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:border-foreground/40 transition-colors"
            />
          </div>
          {err && <div className="text-[11.5px] text-destructive">{err}</div>}
          <button type="button" onClick={requestOtp} disabled={loading || !phone}
            className="w-full h-10 rounded-lg bg-foreground text-background text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-foreground/90 transition-colors">
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</> : <>Send code</>}
          </button>
          <button type="button" onClick={() => { setMode('choice'); setErr(null); }} className="w-full h-8 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
            Back
          </button>
        </div>
      )}

      {mode === 'otp' && (
        <div className="mt-3 space-y-2.5">
          <div className="text-[11.5px] text-muted-foreground">
            Sent a six-digit code to <span className="font-mono">+{phone.replace(/^\+/, '')}</span>.
          </div>
          <input
            autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitOtp(); } }}
            placeholder="• • • • • •"
            className="w-full h-11 px-4 rounded-lg border border-border bg-background text-[18px] tracking-[0.35em] text-center font-mono focus:outline-none focus:border-foreground/40 transition-colors"
          />
          {devOtp && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
              Dev mode — OTP is <span className="font-mono font-semibold">{devOtp}</span>.
            </div>
          )}
          {err && <div className="text-[11.5px] text-destructive">{err}</div>}
          <button type="button" onClick={submitOtp} disabled={loading || otp.length !== 6}
            className="w-full h-10 rounded-lg bg-foreground text-background text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-foreground/90 transition-colors">
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</> : <><KeyRound className="h-3.5 w-3.5" /> Sign in</>}
          </button>
          <button type="button" onClick={() => { setMode('phone'); setOtp(''); setDevOtp(null); setErr(null); }} className="w-full h-8 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}
