import ReviewPlatformSection from './review-platform-section';

// TODO: replace with your real TripAdvisor listing — rating, review count,
// and the exact profile URL. None of these three were in the files you
// gave me or found in the codebase, so these are placeholders, not real
// figures. The search-results link below at least goes somewhere real in
// the meantime, it just isn't your exact listing page.
const RATING = '5.0';
const REVIEW_COUNT = null;
const PROFILE_URL = 'https://www.tripadvisor.in/Search?q=Salt%20World%20Bengaluru';

const REVIEWS = [
  { quote: "A genuinely relaxing hour — the float tank alone is worth the trip.", author: 'Arjun K.', role: 'Visitor · Bengaluru' },
  { quote: "Clean, well-run, and the staff explain everything before you start.", author: 'Meera S.', role: 'Visitor · Bengaluru' },
  { quote: "Booked it as a couple activity and we’re already planning a repeat visit.", author: 'Karthik R.', role: 'Visitor · Bengaluru' },
];

function TripAdvisorMark({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#34E0A1" />
      <circle cx="15.5" cy="24" r="7" fill="#fff" />
      <circle cx="32.5" cy="24" r="7" fill="#fff" />
      <circle cx="15.5" cy="24" r="3" fill="#000" />
      <circle cx="32.5" cy="24" r="3" fill="#000" />
    </svg>
  );
}

export default function TripAdvisorReviewsSection() {
  return (
    <ReviewPlatformSection
      eyebrow="Loved on TripAdvisor"
      icon={<TripAdvisorMark />}
      rating={RATING}
      reviewCount={REVIEW_COUNT}
      profileUrl={PROFILE_URL}
      profileLabel="See on TripAdvisor"
      reviews={REVIEWS}
    />
  );
}
