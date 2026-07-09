import BookingClient from './BookingClient';

export const metadata = {
  title: 'Book a session',
  description: 'Reserve your Salt World session in a few taps. Outcome, therapy, slot, done.',
};

export default async function BookPage({ searchParams }) {
  const sp = await searchParams;
  return <BookingClient initialOutcome={sp?.outcome || null} initialPlan={sp?.plan || null} />;
}
