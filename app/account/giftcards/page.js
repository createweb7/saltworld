import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav, SiteFooter } from '@/components/site/shell';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getDb } from '@/lib/mongo';
import GiftCardsClient from './GiftCardsClient';
import { Gift } from 'lucide-react';

export const metadata = { title: 'Gift cards · Salt World' };

export default async function GiftCardsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login?next=/account/giftcards');
  const db = await getDb();
  const cards = await db.collection('giftcards').find({ claimedByCustomerId: customer.id }).sort({ createdAt: -1 }).toArray();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <main className="container max-w-5xl px-4 md:px-6 pt-24 pb-20">
        <Link href="/account" className="text-[11.5px] uppercase tracking-[0.2em] font-semibold text-muted-foreground hover:text-foreground">← Back to account</Link>
        <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Your gift cards</h1>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground max-w-lg">Claim a card someone gifted you, and use the balance towards any Salt World therapy or membership.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 h-10 text-[12.5px] font-semibold text-foreground">
            <Gift className="h-4 w-4 text-brand" /> {cards.length} card{cards.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="mt-8">
          <GiftCardsClient initialCards={cards.map(({ _id, pin, ...rest }) => rest)} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
