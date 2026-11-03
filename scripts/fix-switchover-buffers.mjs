// One-shot data fix per the business's switch-over buffer spec (sent as a QA
// report, 2026-10-30):
//   "The waiting time while switching between Sessions:
//    After Salt cave: 15min, After float tank: 30min, After IR Sauna: 30min,
//    After Ice Cold plunge: 30min, After Red Light Therapy: 10min."
//
// These five numbers are set on `post_buffer_min` (not `cleaning_buffer_min`)
// because the business is describing guest-facing switch-over wait, not just
// a room-turnover window — see lib/scheduling.js buildJourneyPlan's gap
// formula, which only ever makes the GUEST wait for post_buffer_min (+ the
// next therapy's pre-buffer); cleaning_buffer_min is capped at 30 min for
// the guest's own wait but still fully held on the resource for other
// bookings. Putting everything in post_buffer_min and zeroing
// cleaning_buffer_min makes "guest wait" and "resource block" the same
// number for all five, matching the spec's plain wording.
//
// Exception, QA Issue #7 (2026-11-04): the Float tank needs a 60-min room
// reset between bookings, while the guest still only waits 30 min before
// their next therapy. Float gets post 30 + cleaning 30: the guest's wait
// uses post (cleaning capped at 30), the tank is held for post + cleaning =
// 60, so a 13:00-14:30 session frees the tank for the 15:30 anchor.
//
// The Infrared Sauna <-> Cold Plunge adjacency exception ("30 mins waiting
// time while switching is not applicable when they book both") is NOT data —
// it's handled in code (lib/scheduling.js, isSaunaColdPlungePair), since
// each room still needs its own full post-buffer for ITS next booking; only
// the guest's own in-journey wait between those two specific steps is
// waived.
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

const UPDATES = [
  ['salt-therapy', 15, 0],
  ['float-therapy', 30, 30],
  ['infrared-sauna', 30, 0],
  ['cold-plunge', 30, 0],
  ['red-light-therapy', 10, 0],
];

for (const [slug, postBufferMin, cleaningBufferMin] of UPDATES) {
  const { data, error } = await supabase
    .from('therapies')
    .update({ post_buffer_min: postBufferMin, cleaning_buffer_min: cleaningBufferMin, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select('slug, post_buffer_min, cleaning_buffer_min');
  if (error) throw error;
  if (!data?.length) { console.log(`${slug}: not found, skipped`); continue; }
  console.log(`${slug}: post_buffer_min=${data[0].post_buffer_min} cleaning_buffer_min=${data[0].cleaning_buffer_min}`);
}

console.log('done.');
