import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ReceptionClient from './ReceptionClient';

export const dynamic = 'force-dynamic';

export default async function ReceptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <ReceptionClient user={user} />;
}
