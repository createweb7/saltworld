import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CustomerDetailClient from './CustomerDetailClient';

export const dynamic = 'force-dynamic';

export default async function CustomerPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  const { id } = await params;
  return <CustomerDetailClient user={user} id={id} />;
}
