import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <OrdersClient user={user} />;
}
