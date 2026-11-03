// One-shot data fix: saves the minimum-notice times from the business's
// "Booking System - Rules for Booking" doc (2026-11-04) into the saved
// booking rules (app_settings.bookingRules), which override the code
// defaults in lib/booking-rules.js. Same as entering them under Admin →
// Settings → Booking rules. Leaves every other saved rule as it is.
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Supabase URL/key missing from .env');

const supabase = createClient(url, key);

const LEAD_MIN = {
  'salt-therapy': 30,
  'kids-salt-therapy': 30,
  'float-therapy': 90,
  'red-light-therapy': 15,
  'infrared-sauna': 15,
  'cold-plunge': 45,
  'hot-cold-contrast': 45,
};

const { data: row, error: readErr } = await supabase.from('app_settings').select('value').eq('key', 'bookingRules').maybeSingle();
if (readErr) throw readErr;
const value = row?.value || {};
const next = {
  ...value,
  perTherapyLeadMin: { ...(value.perTherapyLeadMin || {}), ...LEAD_MIN },
  lastStartTime: '21:00',
  sameDayLateCutoff: { afterTime: '19:00', slotsAfter: '20:00' },
};
const { error } = await supabase.from('app_settings').upsert(
  { key: 'bookingRules', value: next, updated_at: new Date().toISOString() },
  { onConflict: 'key' },
);
if (error) throw error;
console.log('saved:', JSON.stringify({ perTherapyLeadMin: next.perTherapyLeadMin, lastStartTime: next.lastStartTime, sameDayLateCutoff: next.sameDayLateCutoff }));
