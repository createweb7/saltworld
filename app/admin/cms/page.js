import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CmsClient from './CmsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <CmsClient user={user} />;
}
