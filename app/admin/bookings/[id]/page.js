import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import BookingDetailClient from './BookingDetailClient';

export const dynamic = 'force-dynamic';

export default async function BookingDetail({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  const { id } = await params;
  return <BookingDetailClient user={user} id={id} />;
}
