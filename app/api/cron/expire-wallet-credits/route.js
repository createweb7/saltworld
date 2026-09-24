// Vercel Cron target — expires booking-earn wallet credits past their
// validity window (see lib/loyalty.js expireWalletCredits). Scheduled in
// vercel.json. Authenticated via CRON_SECRET, which Vercel Cron sends
// automatically as a Bearer token when that env var is set on the project —
// see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  try {
    const { expireWalletCredits } = await import('@/lib/loyalty');
    const results = await expireWalletCredits();
    const totalExpired = results.reduce((s, r) => s + (r.expired || 0), 0);
    return NextResponse.json({ ok: true, customersProcessed: results.length, totalExpiredInr: totalExpired, results });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'expire_failed' }, { status: 500 });
  }
}
