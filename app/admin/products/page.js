import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ComingSoon from '@/components/admin/coming-soon';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return <ComingSoon user={user} title="Products" eyebrow="Retail" description="Product catalog, categories, inventory, orders and low-stock alerts." when="Phase 3.2" />;
}
