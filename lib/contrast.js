// Hot & Cold Contrast (rules doc §6) — shared by the booking page, the
// scheduling engine and the tests.
//
// When a guest books Infrared Sauna + Cold Plunge together (the "Hot & Cold
// Contrast" combo, ₹3,000 solo / ₹4,700 couple) they choose one of two options:
//   Option 1 'alternate' — switch between both rooms in cycles: booked as the
//            single `hot-cold-contrast` therapy, which holds BOTH rooms for 60
//            min (concurrentResources). Same price as the combo.
//   Option 2 'sequence'  — 30 min Sauna, then straight into 30 min Cold
//            Plunge: booked as the two therapies, Sauna first, no wait in
//            between; each room keeps its own usual rules.

export const CONTRAST_SLUG = 'hot-cold-contrast';
export const SAUNA_SLUG = 'infrared-sauna';
export const COLD_SLUG = 'cold-plunge';
export const CONTRAST_OPTIONS = ['alternate', 'sequence'];

/** True when the selection is exactly Infrared Sauna + Cold Plunge (any order). */
export function isContrastPair(slugs) {
  if (!Array.isArray(slugs) || slugs.length !== 2) return false;
  return slugs.includes(SAUNA_SLUG) && slugs.includes(COLD_SLUG);
}

/** The therapies actually booked for a selection + chosen contrast option. */
export function contrastBookingSlugs(slugs, option) {
  if (!isContrastPair(slugs)) return slugs;
  return option === 'alternate' ? [CONTRAST_SLUG] : [SAUNA_SLUG, COLD_SLUG];
}

/** Option 2: Cold Plunge follows the Sauna straight away (no switch-over wait). */
export function isContrastSequenceStep(slugs, prevSlug, slug) {
  return isContrastPair(slugs) && prevSlug === SAUNA_SLUG && slug === COLD_SLUG;
}
