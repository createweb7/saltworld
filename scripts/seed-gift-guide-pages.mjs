// One-shot seed: migrates the old site's 15 SEO gift-guide landing pages
// (saltworld.in/gifts-for-*) into the new site's `pages` CMS table, served
// at the same bare URLs via app/[legacySlug]/page.js. Idempotent — upserts
// by slug, safe to re-run after editing the content below.
//
// Run: node --env-file=.env scripts/seed-gift-guide-pages.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Supabase env vars missing — run with: node --env-file=.env scripts/seed-gift-guide-pages.mjs');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const experiences = (lead) => `
  <p>${lead}</p>
  <ul>
    <li><a href="/therapies/salt-therapy">Salt Cave (halotherapy)</a> — a man-made sea-salt room for breathing, sleep and stress relief.</li>
    <li><a href="/therapies/float-therapy">Float Tank</a> — weightless, silent floating for deep rest and a reset mind.</li>
    <li><a href="/therapies/infrared-sauna">Infrared Sauna</a> — deep-heat sessions for detox, circulation and recovery.</li>
    <li><a href="/therapies/cold-plunge">Ice Cold Plunge</a> — cold immersion for inflammation, mood and energy.</li>
    <li><a href="/therapies/red-light-therapy">Red Light Therapy</a> — skin, recovery and collagen support.</li>
  </ul>
  <p>Every experience is bookable solo or as a couple, and an <a href="/gifts">e-gift card</a> covers any of them — the recipient picks the date, time and package that suits them, and books it themselves whenever they're ready.</p>
`;

const howItWorks = `
  <h2>How Salt World gift cards work</h2>
  <ul>
    <li>Choose an amount, or gift a specific experience from the list above.</li>
    <li>Pay online — the card is issued instantly, no waiting.</li>
    <li>Add the recipient's name now, or send it anonymously and let them claim it later.</li>
    <li>Valid for 12 months, redeemable at our HSR Layout, Bengaluru centre by booking online or on WhatsApp.</li>
  </ul>
`;

const ctaHtml = `
  <p style="margin-top:2rem"><a href="/gifts"><strong>Buy a Salt World gift card →</strong></a></p>
`;

// Renders the real section headings pulled from the equivalent page the
// user downloaded from the live site (saltworld.in), each with one short
// original line — reuses their actual content structure/headings rather
// than inventing new section names, without pasting their paragraph text
// verbatim.
const occasionSections = (items) => items.map(([h, p]) => `<h3>${h}</h3><p>${p}</p>`).join('\n');

// Reuses the exact Unsplash photo URLs already live elsewhere on the site
// (lib/therapies.js heroImage per therapy, lib/outcomes.js HERO_IMG for
// couple-activities) rather than sourcing new images, so these pages stay
// visually consistent with /therapies and /outcomes.
const IMG = {
  salt:    'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=1600&q=80',
  float:   'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1600&q=80',
  sauna:   'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1600&q=80',
  plunge:  'https://images.unsplash.com/photo-1522547902298-51566e4fb383?w=1600&q=80',
  redlight:'https://images.unsplash.com/photo-1611443094820-3fdd4d7a4d18?w=1600&q=80',
  // The one old-site gallery photo that's actually watermarked as Salt
  // World's own (the rest of that gallery was unwatermarked stock, so we
  // left those out) — real couple-float shot, self-hosted at this path.
  couple:  '/uploads/salt-world/gift-guides/couple-float.jpg',
};

const PAGES = [
  {
    slug: 'secret-santa-gifts-for-christmas-in-bangalore',
    heroImage: IMG.sauna,
    h1: 'Secret Santa & Christmas Gifts in Bangalore',
    metaTitle: 'Secret Santa & Christmas Gifts in Bangalore | Salt World',
    metaDescription: 'Skip the usual Secret Santa clutter — gift a Salt Cave, Float Tank or spa-style wellness experience in Bangalore this Christmas.',
    subtitle: 'A Secret Santa gift people actually look forward to using, not another candle.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    // No written copy yet — no source file for this page's content.
  },
  {
    slug: 'surprise-gifts-ideas-in-bangalore',
    heroImage: IMG.salt,
    h1: 'Surprise Gift Ideas in Bangalore',
    metaTitle: 'Surprise Gift Ideas in Bangalore | Salt World',
    metaDescription: 'Looking for a surprise gift in Bangalore that isn’t flowers or chocolates? Gift a Salt Cave, Float Tank or wellness day out instead.',
    subtitle: 'For the person who says they don’t want anything — until they try this.',
    secondaryCtaLabel: 'Browse couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    // No written copy yet — no source file for this page's content.
  },
  {
    slug: 'wedding-gifts-in-bangalore',
    heroImage: IMG.couple,
    h1: 'Wedding Gifts in Bangalore',
    metaTitle: 'Unique Wedding Gifts in Bangalore | Salt World',
    metaDescription: 'Give the newly married couple a shared wellness experience in Bangalore instead of another appliance — Salt World gift cards for couples.',
    subtitle: 'Skip the dinner-set. Gift the newlyweds a day they’ll actually remember.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    // No written copy yet — no source file for this page's content.
  },
  {
    slug: 'wedding-anniversary-gifts-in-bangalore',
    heroImage: IMG.couple,
    h1: 'Wedding Anniversary Gifts in Bangalore',
    metaTitle: 'Wedding Anniversary Gifts in Bangalore | Salt World',
    metaDescription: 'Mark the anniversary with a couple wellness experience in Bangalore — Salt Cave, Float Tank and more, gifted as an instant e-gift card.',
    subtitle: 'An anniversary gift that’s about spending time together, not unwrapping another thing.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    // No written copy yet — no source file for this page's content.
  },
  {
    slug: 'gifts-for-wife-in-bangalore',
    heroImage: IMG.float,
    h1: 'Gifts for Wife in Bangalore',
    metaTitle: 'Gifts for Wife in Bangalore | Birthday, Anniversary & More',
    metaDescription: 'Thoughtful gifts for your wife in Bangalore — Salt Cave, Float Tank and spa-style wellness experiences, delivered as an instant e-gift card.',
    subtitle: 'For birthdays, anniversaries, or just because — a break she’ll actually take.',
    secondaryCtaLabel: 'Explore stress relief', secondaryCtaHref: '/outcomes/stress-relief',
    html: `
      ${occasionSections([
        ['Unique Gift Ideas for Wife', "An e-gift card lets her choose between Float Therapy, Salt Cave and more, instead of guessing her taste."],
        ['Birthday Gifts for Wife', 'A proper break booked around her own schedule, not a thing she has to find space for.'],
        ['Anniversary Gifts for Wife', 'Couple Float or a shared Salt Cave session turns the day into time spent together.'],
        ['Valentine’s Day & Lovers Day Gifts', 'Delivered instantly by email, so it works even for last-minute plans.'],
        ['Best Gifts for Wife’s Birthday', 'Valid for 12 months, so there’s no rush to use it right away.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'birthday-gifts-for-girlfriend-in-bangalore',
    heroImage: IMG.float,
    h1: 'Birthday Gifts for Girlfriend in Bangalore',
    metaTitle: 'Birthday Gifts for Girlfriend in Bangalore | Salt World',
    metaDescription: 'Birthday gift ideas for your girlfriend in Bangalore — Salt Cave, Float Tank and couple wellness experiences, delivered instantly.',
    subtitle: 'A birthday gift that’s an experience, not another thing to find space for.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    // No written copy yet — no source file for this page's content.
  },
  {
    slug: 'gifts-for-men-in-bangalore',
    heroImage: IMG.plunge,
    h1: 'Gifts for Men in Bangalore',
    metaTitle: 'Gifts for Men in Bangalore | Salt World Wellness',
    metaDescription: 'Gift ideas for men in Bangalore who have everything — Salt Cave, Float Tank, Cold Plunge and recovery-focused wellness experiences.',
    subtitle: 'For the man who says he doesn’t need anything — recovery and recovery-adjacent gifts he’ll actually use.',
    secondaryCtaLabel: 'Explore recovery', secondaryCtaHref: '/outcomes/muscle-recovery',
    html: `
      ${occasionSections([
        ['Best Gift Ideas for Men', 'Cold Plunge and Infrared Sauna sessions tend to land better than another gadget or grooming kit.'],
        ['Top Birthday Gifts for Men', 'An experience he gets to book on his own time, rather than something that sits on a shelf.'],
        ['Birthday, Anniversary & Retirement Gifts for Men', 'Flexible amounts work across most occasions, with a 12-month window to use it.'],
        ['Luxury Gifts for Men for Every Season', 'From a single Salt Cave session to a full wellness day out, depending on the budget.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-boyfriend-in-bangalore',
    heroImage: IMG.plunge,
    h1: 'Gifts for Boyfriend in Bangalore',
    metaTitle: 'Gifts for Boyfriend in Bangalore | Birthday, Valentine’s & More',
    metaDescription: 'Gift ideas for your boyfriend in Bangalore — Salt Cave, Float Tank and couple wellness experiences, delivered as an instant e-gift card.',
    subtitle: 'Skip the usual gadgets — gift a day the two of you can actually spend together.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    html: `
      ${occasionSections([
        ['Best Gifts for Boyfriend', "A Salt World e-gift card lets him pick between Float Therapy, Salt Cave, Ice Cold Plunge and more — wellness he'd rarely book for himself."],
        ['Valentine’s Gifts for Boyfriend', 'Delivered by email instantly, so it works even for a last-minute Valentine’s plan.'],
        ['Best Birthday Gifts for Boyfriend', 'A memorable alternative to the usual gadget or wallet, booked at his own convenience.'],
        ['Romantic & Cute Gifts for Boyfriend', 'A Couple Float or shared Salt Cave session turns the gift into time spent together, not just something he unwraps alone.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-husband-in-bangalore',
    heroImage: IMG.sauna,
    h1: 'Gifts for Husband in Bangalore',
    metaTitle: 'Gifts for Husband in Bangalore | Birthday, Anniversary & Valentine’s',
    metaDescription: 'Gift ideas for your husband in Bangalore — Salt Cave, Float Tank and recovery-focused wellness experiences, delivered instantly.',
    subtitle: 'Birthdays, anniversaries, Valentine’s Day — a gift that gives him actual downtime.',
    secondaryCtaLabel: 'Explore recovery', secondaryCtaHref: '/outcomes/muscle-recovery',
    html: `
      ${occasionSections([
        ['Cool Gifts for Husband', "An e-gift card lets him choose his own wellness experience — Float Therapy, Salt Cave or Ice Cold Plunge — rather than receiving something he has to find a use for."],
        ['Birthday Gifts for Husband', 'Float Therapy for weightless stress relief, Salt Cave for a calming reset, or Ice Cold Plunge if he wants something more energising — booked whenever suits him.'],
        ['Anniversary Gifts for Husband', 'Couple Float or a shared Salt Cave session makes the day about time together, not another gadget.'],
        ['Cool & Surprise Gifts for Husband', 'Useful, a little unexpected, and delivered digitally in minutes — good for a same-day surprise.'],
        ['Valentine’s Day Present for Husband', 'An escape from daily stress that’s still thoughtful and personal, valid for 12 months so there’s no pressure to use it right away.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-birthday-in-bangalore',
    heroImage: IMG.salt,
    h1: 'Birthday Gifts in Bangalore',
    metaTitle: 'Birthday Gift Ideas in Bangalore | Salt World',
    metaDescription: 'Unique birthday gift ideas in Bangalore — wellness experiences at Salt World, delivered instantly as an e-gift card for any budget.',
    subtitle: 'A birthday gift that’s actually about them, not about finding the right size.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    html: `
      ${occasionSections([
        ['Birthday Gifts for Mom', 'Give the gift of wellness — a Salt Cave or Float session she’d rarely book for herself.'],
        ['Birthday Gift for Wife', 'A present she’ll remember past the week it was given.'],
        ['Birthday Gifts for Men', 'Recovery-focused picks — Cold Plunge, Infrared Sauna — that tend to land better than another gadget.'],
        ['Birthday Gift for Husband', 'Celebrate with an experience instead of a thing to find shelf space for.'],
        ['Birthday Gifts for Girlfriend & Boyfriend', 'Solo or as a couple — surprise with something different from the usual.'],
        ['Birthday Gift Ideas for Family & Friends', 'Flexible amounts and a 12-month window make it easy for any birthday on the calendar.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-valentines-day-in-bangalore',
    heroImage: IMG.couple,
    h1: 'Valentine’s Day Gifts in Bangalore',
    metaTitle: 'Valentine’s Day Gifts in Bangalore | Salt World',
    metaDescription: 'Valentine’s Day gift ideas in Bangalore — couple wellness experiences at Salt World, delivered instantly as an e-gift card.',
    subtitle: 'Skip the flowers that wilt in a week — gift an afternoon together instead.',
    secondaryCtaLabel: 'See couple activities', secondaryCtaHref: '/best-couple-activities-in-bangalore',
    html: `
      ${experiences('Couple-friendly picks for Valentine’s Day:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-mothers-day-in-bangalore',
    heroImage: IMG.salt,
    h1: 'Mother’s Day Gifts in Bangalore',
    metaTitle: 'Mother’s Day Gift Ideas in Bangalore | Salt World',
    metaDescription: 'Mother’s Day gift ideas in Bangalore — gift your mother a Salt Cave or Float Tank wellness experience, delivered as an instant e-gift card.',
    subtitle: 'A Mother’s Day gift that gives her permission to rest, not one more thing to manage.',
    secondaryCtaLabel: 'Explore stress relief', secondaryCtaHref: '/outcomes/stress-relief',
    html: `
      ${occasionSections([
        ['Unique Mother’s Day Gifts in Bangalore', 'A wellness experience stands out from the usual flowers-and-cards routine.'],
        ['Mother’s Day Gift Ideas She’ll Truly Love', 'Salt Cave and Float sessions are both gentle, low-effort ways for her to spend an hour entirely on herself.'],
        ['Buy the Best Mother’s Day Gift Card in Bangalore', 'Pick an amount or a specific experience — issued instantly, no waiting on delivery.'],
        ['Give the Gift of Wellness This Mother’s Day', 'Valid for 12 months, so she can book it whenever actually suits her.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-fathers-day-in-bangalore',
    heroImage: IMG.plunge,
    h1: 'Father’s Day Gifts in Bangalore',
    metaTitle: 'Father’s Day Gift Ideas in Bangalore | Salt World',
    metaDescription: 'Father’s Day gift ideas in Bangalore — gift your father a recovery-focused wellness experience at Salt World, delivered instantly.',
    subtitle: 'A Father’s Day gift built around actual recovery, not another tie.',
    secondaryCtaLabel: 'Explore recovery', secondaryCtaHref: '/outcomes/muscle-recovery',
    html: `
      ${occasionSections([
        ['Best Father’s Day Gift Ideas in Bangalore', 'Infrared Sauna and Ice Cold Plunge both suit recovery and circulation better than another tie.'],
        ['Buy Father’s Day Gift Cards in Bangalore', 'Pick an amount or a specific experience, issued instantly online.'],
        ['Wellness Gifts for Dad in Bangalore', 'Salt Cave is a gentler option if he’s not usually one for spa-style gifts.'],
        ['Why Choose Salt World for Father’s Day Gifts?', 'Real recovery-focused experiences, not just another novelty gift.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'gifts-for-special-day-in-bangalore',
    heroImage: IMG.redlight,
    h1: 'Gifts for a Special Day in Bangalore',
    metaTitle: 'Gift Ideas for Any Special Day in Bangalore | Salt World',
    metaDescription: 'Celebrating a promotion, graduation or milestone in Bangalore? Gift a Salt World wellness experience — instant e-gift card, any amount.',
    subtitle: 'Promotions, graduations, milestones — mark it with time off, not more stuff.',
    secondaryCtaLabel: 'Explore all outcomes', secondaryCtaHref: '/outcomes',
    html: `
      ${occasionSections([
        ['Celebrate Every Occasion with a Wellness Experience', 'Not every gift needs a named holiday — a promotion, graduation or "you deserve this" is reason enough.'],
        ['Perfect Gift Card for Every Celebration', 'Choose any amount and let the recipient put it toward whichever experience suits the moment.'],
        ['Buy Special Occasion Gift Cards in Bangalore', 'Issued instantly online, valid for 12 months.'],
      ])}
      ${experiences('The experiences a gift card can cover:')}
      ${howItWorks}
      ${ctaHtml}
    `,
  },
  {
    slug: 'best-couple-activities-in-bangalore',
    heroImage: IMG.couple,
    h1: 'Best Couple Activities in Bangalore',
    metaTitle: 'Best Couple Activities in Bangalore | Salt World',
    metaDescription: 'Looking for a couple activity in Bangalore beyond dinner and a movie? Try a Salt Cave or Float Tank session for two at Salt World.',
    subtitle: 'For when dinner-and-a-movie has run its course.',
    secondaryCtaLabel: 'Browse gifts for your partner', secondaryCtaHref: '/gifts-for-husband-in-bangalore',
    // No written copy yet — no source file for this page's content.
  },
];

(async () => {
  const now = new Date().toISOString();
  for (const page of PAGES) {
    const sections = [
      {
        id: crypto.randomUUID(),
        type: 'hero',
        props: {
          eyebrow: 'Gift Experiences',
          title: page.h1,
          subtitle: page.subtitle,
          primaryCtaLabel: 'Buy a gift card',
          primaryCtaHref: '/gifts',
          heroImage: page.heroImage,
          secondaryCtaLabel: page.secondaryCtaLabel,
          secondaryCtaHref: page.secondaryCtaHref,
        },
      },
    ];
    if (page.html) {
      sections.push({ id: crypto.randomUUID(), type: 'content', props: { title: '', html: page.html } });
    }

    const { data: existing } = await supabase.from('pages').select('id').eq('slug', page.slug).maybeSingle();
    const data = {
      title: page.h1,
      sections,
      seo: {
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        canonical: `https://saltworld.in/${page.slug}`,
      },
      publishedAt: now,
    };

    if (existing) {
      await supabase.from('pages').update({ status: 'published', updated_at: now, data }).eq('id', existing.id);
      console.log('updated', page.slug);
    } else {
      await supabase.from('pages').insert({ id: crypto.randomUUID(), slug: page.slug, status: 'published', created_at: now, updated_at: now, data });
      console.log('created', page.slug);
    }
  }
  console.log(`\nDone — ${PAGES.length} gift-guide pages published.`);
})();
