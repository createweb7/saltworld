import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CouponsClient from './CouponsClient';

export const metadata = { title: 'Coupons · Salt World BOS' };

export default async function CouponsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <CouponsClient user={user} />;
}
