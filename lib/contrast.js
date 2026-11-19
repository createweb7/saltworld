// Hot & Cold Contrast (rules doc §6) — shared by the booking page, the
// scheduling engine and the tests.
//
// Whenever a booking has Infrared Sauna AND Cold Plunge in it (on their own —
// the "Hot & Cold Contrast" combo, ₹3,000 solo / ₹4,700 couple — or inside a
// bigger package), the guest chooses one of two options on the Date & time
// step. Both cost the same as the matching combo:
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

/** True when the selection has both Infrared Sauna and Cold Plunge (any order, any extras). */
export function hasContrastPair(slugs) {
  return Array.isArray(slugs) && slugs.includes(SAUNA_SLUG) && slugs.includes(COLD_SLUG);
}

/** True when the selection is exactly Infrared Sauna + Cold Plunge (any order). */
export function isContrastPair(slugs) {
  return hasContrastPair(slugs) && slugs.length === 2;
}

/**
 * The therapies actually booked for a selection + chosen contrast option,
 * keeping the guest's order for everything else: Sauna + Cold Plunge become
 * one `hot-cold-contrast` step (Option 1), or Sauna then Cold Plunge side by
 * side (Option 2), where the first of the two was.
 */
export function contrastBookingSlugs(slugs, option) {
  if (!hasContrastPair(slugs)) return slugs;
  const at = Math.min(slugs.indexOf(SAUNA_SLUG), slugs.indexOf(COLD_SLUG));
  const rest = slugs.filter((s) => s !== SAUNA_SLUG && s !== COLD_SLUG);
  const pair = option === 'alternate' ? [CONTRAST_SLUG] : [SAUNA_SLUG, COLD_SLUG];
  return [...rest.slice(0, at), ...pair, ...rest.slice(at)];
}

/** For a price lookup: the contrast step counts as Sauna + Cold Plunge. */
export function expandContrast(slugs) {
  return (slugs || []).flatMap((s) => (s === CONTRAST_SLUG ? [SAUNA_SLUG, COLD_SLUG] : [s]));
}

/** Option 2: Cold Plunge follows the Sauna straight away (no switch-over wait). */
export function isContrastSequenceStep(slugs, prevSlug, slug) {
  return hasContrastPair(slugs) && prevSlug === SAUNA_SLUG && slug === COLD_SLUG;
}
