import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ComingSoon from '@/components/admin/coming-soon';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <ComingSoon user={user} title="Marketing" eyebrow="Growth" description="Campaigns, Google reviews, testimonials, popups, announcement bar." when="Phase 3.3" />;
}
