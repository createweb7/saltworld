import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <CalendarClient user={user} />;
}
