import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getSupabase } from '@/lib/supabase';
import { toGiftcard } from '@/lib/db-mappers';
import { TopNav, SiteFooter } from '@/components/site/shell';
import GiftCertificateClient from './GiftCertificateClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your gift' };

export default async function GiftDetailPage({ params }) {
  const { id } = await params;
  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(`/account/gifts/${id}`)}`);
  const supabase = getSupabase();
  const { data: row } = await supabase.from('giftcards').select('*').eq('id', id).maybeSingle();
  if (!row || row.data?.purchasedByCustomerId !== customer.id) notFound();
  const gift = toGiftcard(row);

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print">
        <TopNav transparentHero={false} />
      </div>
      <main className="pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-[700px] mx-auto px-5 md:px-8">
          <div className="no-print">
            <Link href="/account/gifts" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to your gifts</Link>
          </div>
          <GiftCertificateClient gift={gift} />
        </div>
      </main>
      <div className="no-print">
        <SiteFooter />
      </div>
    </div>
  );
}
