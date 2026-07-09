import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ComingSoon from '@/components/admin/coming-soon';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <ComingSoon user={user} title="AI Assistant" eyebrow="Intelligence" description="Customer insights, inactive-customer alerts, cross-sell suggestions and a dashboard assistant." when="Phase 3.3" />;
}
