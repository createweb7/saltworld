'use client';

// Emergent Auth (Google) callback page. Reads `session_id` from the URL
// fragment, POSTs it to /api/customer/auth/google-complete which fetches the
// verified profile from Emergent, upserts the customer, and issues the
// sw_customer cookie. Then redirects to /account.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Wordmark } from '@/components/site/shell';

export default function AuthCompletePage() {
  const [status, setStatus] = useState('loading'); // loading | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const sessionId = params.get('session_id');
      if (!sessionId) {
        setErrorMsg('We couldn\u2019t find a sign-in token. Please try signing in again.');
        setStatus('error');
        return;
      }
      try {
        const res = await fetch('/api/customer/auth/google-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) {
          if (j.error === 'account_disabled') setErrorMsg('This account has been disabled. Please contact support.');
          else if (j.error === 'emergent_session_invalid') setErrorMsg('Your sign-in session expired. Please try again.');
          else setErrorMsg('Sign-in failed. Please try again.');
          setStatus('error');
          return;
        }
        // Clean the fragment to avoid re-processing on refresh.
        window.history.replaceState(null, '', window.location.pathname);
        // Redirect (full nav so the sw_customer cookie is loaded on next request).
        window.location.assign('/account');
      } catch {
        setErrorMsg('We could not complete sign-in. Check your connection and try again.');
        setStatus('error');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 md:px-8 pt-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Salt World
        </Link>
        <Wordmark />
      </header>
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px] text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto h-14 w-14 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="mt-5 font-serif text-[26px] leading-tight tracking-tight">Signing you in…</h1>
              <p className="mt-2 text-[13px] text-muted-foreground leading-[1.55]">
                We&rsquo;re verifying your Google account and setting up your session.
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 text-red-600 inline-flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="mt-5 font-serif text-[26px] leading-tight tracking-tight">Sign-in didn&rsquo;t complete</h1>
              <p className="mt-2 text-[13px] text-muted-foreground leading-[1.55]">{errorMsg}</p>
              <Link href="/account/login" className="mt-6 h-11 px-4 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-foreground/90">
                Try again
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
