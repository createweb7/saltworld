import { createClient } from '@supabase/supabase-js';

// Server-side client — uses the service_role key, so it bypasses Postgres
// row-level security entirely. Authorization is enforced in application
// code (permission checks in lib/api/admin.js, session checks in
// lib/auth.js / lib/customer-auth.js), mirroring how the previous MongoDB
// setup worked (Mongo has no row-level access control either). Never import
// this file into client components — the service_role key must stay
// server-only.
let _client;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing');
  if (!key) throw new Error('SUPABASE_SECRET_KEY missing');
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
