import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CalendarBlocksClient from './CalendarBlocksClient';

export const metadata = { title: 'Calendar Blocks · Salt World BOS' };

export default async function CalendarBlocksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <CalendarBlocksClient user={user} />;
}
