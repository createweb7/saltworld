import { Star } from 'lucide-react';

// Shared layout for a single review platform's section (rating badge +
// a few representative quotes) — used by GoogleReviewsSection and
// TripAdvisorReviewsSection so every gift-guide page renders both the same
// way. Quotes are representative, not scraped verbatim review text (that
// belongs to the individual reviewers); the badge links out to the real
// listing so visitors can read the actual reviews there.
export default function ReviewPlatformSection({ eyebrow, icon, rating, reviewCount, profileUrl, profileLabel, reviews }) {
  return (
    <section className="py-14 md:py-20 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{eyebrow}</div>
          <div className="inline-flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3">
            {icon}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-[22px] leading-none tracking-tight">{rating}</span>
                <span className="flex items-center gap-0.5">{[0,1,2,3,4].map((k) => <Star key={k} className="h-3 w-3 fill-current" style={{ color: 'hsl(var(--aurora))' }} />)}</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                {reviewCount ? `${reviewCount} verified reviews · ` : ''}
                <a href={profileUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{profileLabel}</a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {reviews.map((r, i) => (
            <figure key={i} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">{[0,1,2,3,4].map((k) => <Star key={k} className="h-3.5 w-3.5 fill-current" style={{ color: 'hsl(var(--aurora))' }} />)}</div>
                <div className="opacity-70">{icon}</div>
              </div>
              <blockquote className="mt-4 font-serif text-[17px] leading-[1.4] text-foreground text-pretty">&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 pt-4 border-t border-border">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground border border-border">
                  {r.author.split(' ').map((x) => x[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div className="text-[12.5px] font-medium">{r.author}</div>
                  <div className="text-[11px] text-muted-foreground">{r.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
