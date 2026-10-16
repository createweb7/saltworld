// The set of SEO landing pages migrated from the old site's "Gifting
// Options" footer column (saltworld.in/gifts-for-*). Each entry's `slug`
// must match a published row in the `pages` table — these are plain CMS
// pages served at the bare root URL (see app/[legacySlug]/page.js), not
// under /p/, so the old URLs keep working unchanged for search rankings.
// This list drives the cross-link block rendered at the bottom of each of
// these pages, so they interlink the way the old footer column did.
export const GIFT_GUIDES = [
  { slug: 'secret-santa-gifts-for-christmas-in-bangalore', label: "Gifts For Christmas" },
  { slug: 'surprise-gifts-ideas-in-bangalore',              label: 'Surprise Gifts' },
  { slug: 'wedding-gifts-in-bangalore',                     label: 'Wedding Gifts' },
  { slug: 'wedding-anniversary-gifts-in-bangalore',         label: 'Gifts For Wedding Anniversary' },
  { slug: 'gifts-for-wife-in-bangalore',                    label: 'Gifts For Wife' },
  { slug: 'birthday-gifts-for-girlfriend-in-bangalore',     label: 'Gifts For Girlfriend' },
  { slug: 'gifts-for-men-in-bangalore',                     label: 'Gifts For Men' },
  { slug: 'gifts-for-boyfriend-in-bangalore',               label: 'Gifts For Boyfriend' },
  { slug: 'gifts-for-husband-in-bangalore',                 label: 'Gifts For Husband' },
  { slug: 'gifts-for-birthday-in-bangalore',                label: 'Gifts For Birthday' },
  { slug: 'gifts-for-valentines-day-in-bangalore',          label: 'Gifts For Valentine’s Day' },
  { slug: 'gifts-for-mothers-day-in-bangalore',             label: "Gifts For Mother's Day" },
  { slug: 'gifts-for-fathers-day-in-bangalore',             label: "Gifts For Father's Day" },
  { slug: 'gifts-for-special-day-in-bangalore',             label: 'Gifts For Special Day' },
  { slug: 'best-couple-activities-in-bangalore',            label: 'Best Couple Activities in Bangalore' },
];

export const GIFT_GUIDE_SLUGS = new Set(GIFT_GUIDES.map((g) => g.slug));
