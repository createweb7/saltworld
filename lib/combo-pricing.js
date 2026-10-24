// Named multi-therapy bundle pricing — the old site (saltworld.in/pricing)
// sold every 2-5 therapy combination from {Salt Cave, Float, Infrared Sauna,
// Ice Cold Plunge, Red Light} as a fixed-price package, discounted below the
// sum of its individual therapy prices (e.g. Salt + Float 60 + Sauna, Solo:
// ₹6,000, vs ₹7,200 for the three therapies priced separately). The new
// booking engine had no equivalent — it only ever summed individual line
// prices — so any multi-therapy journey was overcharged relative to the old
// site. This table was supplied directly by the business (service_combo
// table dump from the current production site, 2026-10-24) and reproduces
// every combo exactly; it's the actual charged price (the SQL dump's
// `price` column — `act_price` is just the struck-through "before discount"
// reference shown next to it, not a real amount ever charged).
//
// Table doesn't cover Family tier (not present in the source dump) or any
// combo involving >1 guest beyond "couple" (2 guests) — those fall back to
// the existing per-line summed pricing untouched.
const COMBOS = {
  'couple|cold-plunge,float-therapy,infrared-sauna,red-light-therapy,salt-therapy|60': 12000,
  'couple|cold-plunge,float-therapy,infrared-sauna,red-light-therapy,salt-therapy|90': 13000,
  'couple|cold-plunge,float-therapy,infrared-sauna,red-light-therapy|60': 10300,
  'couple|cold-plunge,float-therapy,infrared-sauna,red-light-therapy|90': 11100,
  'couple|cold-plunge,float-therapy,infrared-sauna,salt-therapy|60': 9500,
  'couple|cold-plunge,float-therapy,infrared-sauna,salt-therapy|90': 10000,
  'couple|cold-plunge,float-therapy,infrared-sauna|60': 8000,
  'couple|cold-plunge,float-therapy,infrared-sauna|90': 9000,
  'couple|cold-plunge,float-therapy,red-light-therapy,salt-therapy|60': 9000,
  'couple|cold-plunge,float-therapy,red-light-therapy,salt-therapy|90': 10000,
  'couple|cold-plunge,float-therapy,red-light-therapy|60': 7000,
  'couple|cold-plunge,float-therapy,red-light-therapy|90': 8000,
  'couple|cold-plunge,float-therapy,salt-therapy|60': 6000,
  'couple|cold-plunge,float-therapy,salt-therapy|90': 7000,
  'couple|cold-plunge,float-therapy|60': 4700,
  'couple|cold-plunge,float-therapy|90': 5600,
  'couple|cold-plunge,infrared-sauna,red-light-therapy,salt-therapy|na': 9000,
  'couple|cold-plunge,infrared-sauna,red-light-therapy|na': 7000,
  'couple|cold-plunge,infrared-sauna,salt-therapy|na': 6300,
  'couple|cold-plunge,infrared-sauna|na': 4700,
  'couple|cold-plunge,red-light-therapy,salt-therapy|na': 5800,
  'couple|cold-plunge,red-light-therapy|na': 3800,
  'couple|cold-plunge,salt-therapy|na': 3100,
  'couple|float-therapy,infrared-sauna,red-light-therapy,salt-therapy|60': 11100,
  'couple|float-therapy,infrared-sauna,red-light-therapy,salt-therapy|90': 11900,
  'couple|float-therapy,infrared-sauna,red-light-therapy|60': 9000,
  'couple|float-therapy,infrared-sauna,red-light-therapy|90': 10000,
  'couple|float-therapy,infrared-sauna,salt-therapy|60': 8000,
  'couple|float-therapy,infrared-sauna,salt-therapy|90': 9000,
  'couple|float-therapy,infrared-sauna|60': 7000,
  'couple|float-therapy,infrared-sauna|90': 8000,
  'couple|float-therapy,red-light-therapy,salt-therapy|60': 7700,
  'couple|float-therapy,red-light-therapy,salt-therapy|90': 8700,
  'couple|float-therapy,red-light-therapy|60': 5800,
  'couple|float-therapy,red-light-therapy|90': 6800,
  'couple|float-therapy,salt-therapy|60': 5500,
  'couple|float-therapy,salt-therapy|90': 6000,
  'couple|infrared-sauna,red-light-therapy,salt-therapy|na': 7800,
  'couple|infrared-sauna,red-light-therapy|na': 5900,
  'couple|infrared-sauna,salt-therapy|na': 5000,
  'couple|red-light-therapy,salt-therapy|na': 4600,
  'solo|cold-plunge,float-therapy,infrared-sauna,red-light-therapy,salt-therapy|60': 8400,
  'solo|cold-plunge,float-therapy,infrared-sauna,red-light-therapy,salt-therapy|90': 9400,
  'solo|cold-plunge,float-therapy,infrared-sauna,red-light-therapy|60': 7100,
  'solo|cold-plunge,float-therapy,infrared-sauna,red-light-therapy|90': 8100,
  'solo|cold-plunge,float-therapy,infrared-sauna,salt-therapy|60': 7000,
  'solo|cold-plunge,float-therapy,infrared-sauna,salt-therapy|90': 7600,
  'solo|cold-plunge,float-therapy,infrared-sauna|60': 5500,
  'solo|cold-plunge,float-therapy,infrared-sauna|90': 6500,
  'solo|cold-plunge,float-therapy,red-light-therapy,salt-therapy|60': 6300,
  'solo|cold-plunge,float-therapy,red-light-therapy,salt-therapy|90': 7300,
  'solo|cold-plunge,float-therapy,red-light-therapy|60': 5000,
  'solo|cold-plunge,float-therapy,red-light-therapy|90': 6000,
  'solo|cold-plunge,float-therapy,salt-therapy|60': 4700,
  'solo|cold-plunge,float-therapy,salt-therapy|90': 5700,
  'solo|cold-plunge,float-therapy|60': 3500,
  'solo|cold-plunge,float-therapy|90': 4400,
  'solo|cold-plunge,infrared-sauna,red-light-therapy,salt-therapy|na': 6000,
  'solo|cold-plunge,infrared-sauna,red-light-therapy|na': 4700,
  'solo|cold-plunge,infrared-sauna,salt-therapy|na': 4500,
  'solo|cold-plunge,infrared-sauna|na': 3000,
  'solo|cold-plunge,red-light-therapy,salt-therapy|na': 3900,
  'solo|cold-plunge,red-light-therapy|na': 2500,
  'solo|cold-plunge,salt-therapy|na': 2100,
  'solo|float-therapy,infrared-sauna,red-light-therapy,salt-therapy|60': 7700,
  'solo|float-therapy,infrared-sauna,red-light-therapy,salt-therapy|90': 8500,
  'solo|float-therapy,infrared-sauna,red-light-therapy|60': 6300,
  'solo|float-therapy,infrared-sauna,red-light-therapy|90': 7300,
  'solo|float-therapy,infrared-sauna,salt-therapy|60': 6000,
  'solo|float-therapy,infrared-sauna,salt-therapy|90': 7000,
  'solo|float-therapy,infrared-sauna|60': 5000,
  'solo|float-therapy,infrared-sauna|90': 6000,
  'solo|float-therapy,red-light-therapy,salt-therapy|60': 5500,
  'solo|float-therapy,red-light-therapy,salt-therapy|90': 6500,
  'solo|float-therapy,red-light-therapy|60': 4200,
  'solo|float-therapy,red-light-therapy|90': 5200,
  'solo|float-therapy,salt-therapy|60': 4000,
  'solo|float-therapy,salt-therapy|90': 4600,
  'solo|infrared-sauna,red-light-therapy,salt-therapy|na': 5200,
  'solo|infrared-sauna,red-light-therapy|na': 3800,
  'solo|infrared-sauna,salt-therapy|na': 3500,
  'solo|red-light-therapy,salt-therapy|na': 3100,
};

/**
 * Looks up the fixed bundle price for a set of 2+ distinct therapy slugs,
 * if one exists. Returns null when there's no match (any guest count other
 * than 1/2, any therapy outside the 5 covered, or a combo the old site
 * never sold as a package) — callers should fall back to summing
 * individual line prices as before.
 */
export function resolveComboPrice({ slugs = [], sessionMode = 'single', floatDurationMin } = {}) {
  const distinct = [...new Set(slugs)];
  if (distinct.length < 2) return null;
  const type = sessionMode === 'couple' ? 'couple' : 'solo';
  const sortedSlugs = [...distinct].sort().join(',');
  const floatKey = distinct.includes('float-therapy') ? String(Number(floatDurationMin) || 60) : 'na';
  const key = `${type}|${sortedSlugs}|${floatKey}`;
  return Object.prototype.hasOwnProperty.call(COMBOS, key) ? COMBOS[key] : null;
}
