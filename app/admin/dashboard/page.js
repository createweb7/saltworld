import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <DashboardClient user={user} />;
}
