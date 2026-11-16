// One-shot data fix: Hot & Cold Contrast per the "Rules for Booking" doc §6,
// agreed with the business 2026-11-11.
//
// Option 1 (alternate between Sauna and Cold Plunge) is booked as the
// `hot-cold-contrast` therapy, which already holds both rooms for 60 min
// (concurrent_resources + both rooms linked). This sets:
//   • price = the Sauna + Cold Plunge combo: ₹3,000 solo / ₹4,700 couple
//   • guest waits 30 min before their next therapy (post_buffer_min 30) and
//     both rooms stay held 45 min after the session (post 30 + cleaning 15),
//     the doc's 45-min gap between slots
//   • booking notice 45 min (saved booking rules had 30)
// Option 2 (Sauna then Cold Plunge) is the existing combo — no data change.
//
// Idempotent — safe to re-run.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv() {
  const env = {};
  for (const path of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    } catch {}
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Supabase URL/key missing from .env');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const now = new Date().toISOString();

const { data: rows, error: readErr } = await supabase.from('therapies').select('id, data').eq('slug', 'hot-cold-contrast');
if (readErr) throw readErr;
if (!rows?.length) throw new Error('hot-cold-contrast therapy not found');

const { data: updated, error } = await supabase.from('therapies').update({
  default_price: 3000,
  duration_min: 60,
  duration_options: [{ label: '60 min', durationMin: 60, priceSingle: 3000, priceCouple: 4700 }],
  post_buffer_min: 30,
  cleaning_buffer_min: 15,
  max_capacity: 1,
  concurrent_resources: true,
  description: 'Infrared Sauna and Cold Plunge in one session — alternate between them for 60 minutes, or 30 minutes of each.',
  data: { ...(rows[0].data || {}), minLeadTimeMin: 45, displayDurationLabel: '60 min' },
  updated_at: now,
}).eq('id', rows[0].id).select('slug, default_price, duration_options, post_buffer_min, cleaning_buffer_min');
if (error) throw error;
console.log('therapy:', JSON.stringify(updated[0]));

const { data: setting, error: sErr } = await supabase.from('app_settings').select('value').eq('key', 'bookingRules').maybeSingle();
if (sErr) throw sErr;
if (setting?.value?.perTherapyLeadMin) {
  const value = { ...setting.value, perTherapyLeadMin: { ...setting.value.perTherapyLeadMin, 'hot-cold-contrast': 45 } };
  const { error: uErr } = await supabase.from('app_settings').update({ value }).eq('key', 'bookingRules');
  if (uErr) throw uErr;
  console.log('booking rules: hot-cold-contrast lead time = 45 min');
} else {
  console.log('booking rules: no saved per-therapy lead times, code default (45) applies');
}
console.log('done.');
