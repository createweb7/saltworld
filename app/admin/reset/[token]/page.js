'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function ResetPage() {
  const { token } = useParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (password !== confirm) return toast.error('Passwords don\u2019t match.');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'reset_failed');
      toast.success('Password reset. Please sign in.');
      router.push('/admin/login');
    } catch (e) {
      toast.error(e.message === 'token_expired' ? 'This link has expired.' : 'Reset failed. Request a new link.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-[380px]">
        <Link href="/admin/login" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <h1 className="mt-6 text-[26px] font-semibold tracking-tight">Set a new password</h1>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-[0.14em]">New password</label>
            <input autoFocus type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full h-11 px-3.5 rounded-md border border-input bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-[0.14em]">Confirm password</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full h-11 px-3.5 rounded-md border border-input bg-background text-[14px] focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 rounded-md bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
