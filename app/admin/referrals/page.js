import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ReferralsClient from './ReferralsClient';

export const metadata = { title: 'Referrals & Loyalty · Salt World BOS' };

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <ReferralsClient user={user} />;
}
