import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ensureSeed } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export default async function AdminIndex() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  redirect('/admin/dashboard');
}
