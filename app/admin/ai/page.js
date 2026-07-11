import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AiClient from './AiClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <AiClient user={user} />;
}
