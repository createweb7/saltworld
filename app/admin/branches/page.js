import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import BranchesClient from './BranchesClient';

export const metadata = { title: 'Branches · Salt World BOS' };

export default async function BranchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <BranchesClient user={user} />;
}
