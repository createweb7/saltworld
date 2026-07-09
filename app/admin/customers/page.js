import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <CustomersClient user={user} />;
}
