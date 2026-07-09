import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import BookingsClient from './BookingsClient';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <BookingsClient user={user} />;
}
