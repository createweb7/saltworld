-- Salt World — Postgres schema (MongoDB -> Supabase migration)
--
-- Design notes:
--   - Every table's `id` is a UUID and matches the app's existing Mongo `id`
--     field values 1:1 (the app never relied on Mongo's own _id, so no
--     remapping pass is needed when migrating data).
--   - Authorization stays in application code (mirrors the current Mongo
--     setup, which has no DB-level access control) — RLS is left disabled
--     throughout. The Next.js server uses the service_role key.
--   - Two schema styles are used deliberately:
--       1. Real typed columns + FKs for the business-critical, query-heavy
--          domains (bookings, customers, therapies, memberships, pricing).
--       2. `data jsonb` + a few indexed top-level columns for CMS/admin
--          content that's mostly generic CRUD today (pages, blog, media,
--          marketing, settings). These can be normalized further later if a
--          real query need shows up.
--   - Mongo's `settings`/`integrations` "one collection, many shapes keyed
--     by `key`" pattern becomes a single `app_settings(key, value jsonb)`
--     table per domain (settings, integrations) rather than N dedicated
--     tables, to keep this migration tractable — same flexibility, real FK
--     safety is not needed here since each key's shape is only read/written
--     by one domain module.
--   - Mongo's manual `counters` collection (invoice numbering via
--     find-and-$inc) is replaced by a native Postgres SEQUENCE.

create extension if not exists pgcrypto;

-- =====================================================================
-- Core
-- =====================================================================

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_default boolean not null default false,
  hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  role text not null default 'reception',
  permissions text[] not null default '{}',
  status text not null default 'active',
  branch_id uuid references branches(id),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index password_resets_token_idx on password_resets(token);

create table customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  name text default '',
  email text default '',
  phone text default '',
  dob date,
  tags text[] not null default '{}',
  wallet_balance numeric not null default 0,
  lifetime_value numeric not null default 0,
  emergency_contact jsonb,
  medical_notes text default '',
  preferred_therapist_id uuid,
  picture text,
  email_verified boolean not null default false,
  auth_methods text[] not null default '{}',
  source text default 'customer_portal',
  status text not null default 'active',
  last_visit_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_branch_created_idx on customers(branch_id, created_at desc);
create index customers_phone_idx on customers(phone);
create index customers_email_idx on customers(email);
-- Replaces the Mongo `{name,email,phone: 'text'}` text index. Trigram GIN
-- indexes support fast ILIKE/partial-match search on each field; combine
-- with `similarity()`/`%` operators from pg_trgm if ranked search is needed.
create extension if not exists pg_trgm;
create index customers_name_trgm_idx on customers using gin (name gin_trgm_ops);
create index customers_email_trgm_idx on customers using gin (email gin_trgm_ops);
create index customers_phone_trgm_idx on customers using gin (phone gin_trgm_ops);

create table notes (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null,
  parent_id uuid not null,
  body text not null,
  author_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index notes_parent_idx on notes(parent_type, parent_id);

-- =====================================================================
-- Catalog — therapies, resources, journeys, packages
-- =====================================================================

create table therapies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_system boolean not null default false,
  active boolean not null default true,
  online_booking_enabled boolean not null default true,
  duration_min int not null default 60,
  pre_buffer_min int not null default 0,
  post_buffer_min int not null default 0,
  cleaning_buffer_min int not null default 0,
  max_capacity int not null default 1,
  concurrent_resources boolean not null default false,
  default_price numeric not null default 0,
  duration_options jsonb, -- e.g. Float Tank's 60/90-min x single/couple price matrix
  tax_hsn text,
  description text,
  hero_image text,
  images text[] not null default '{}',
  branch_ids uuid[] not null default '{}', -- empty = all branches
  seo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  capacity int not null default 1,
  supported_modes text[] not null default '{}',
  branch_id uuid references branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Many-to-many: which resources a therapy can be assigned to.
-- `concurrent_resources` on the therapy row (above) says whether a booking
-- needs ANY ONE of these (default) or ALL of them locked simultaneously
-- (e.g. Hot & Cold Contrast — sauna + plunge pool at once).
create table therapy_resources (
  therapy_id uuid not null references therapies(id) on delete cascade,
  resource_id uuid not null references resources(id) on delete cascade,
  primary key (therapy_id, resource_id)
);

-- Journeys / Packages — service-catalog variants alongside therapies.
-- Lighter schema: common fields + a jsonb bag for the rest, since their
-- exact field set is admin-defined content, not query-critical.
create table journeys (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  active boolean not null default true,
  default_price numeric default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  active boolean not null default true,
  default_price numeric default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Bookings — the core operational domain
-- =====================================================================

create table bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  branch_id uuid references branches(id),
  customer_id uuid references customers(id),
  booked_for_other boolean not null default false,
  outcome text,
  outcome_label text,
  session_mode text, -- 'single' | 'couple' (float tank)
  contact_name text default '',
  contact_phone text default '',
  contact_email text default '',
  start_at timestamptz,
  blocked_from timestamptz,
  blocked_to timestamptz,
  guests int not null default 1,
  status text not null default 'confirmed',
  payment text not null default 'at-visit',
  total numeric not null default 0,
  pricing_breakdown jsonb, -- write-once audit snapshot from the pricing engine
  coupon_id uuid,
  coupon_code text,
  coupon_discount numeric not null default 0,
  primary_resource_id uuid references resources(id),
  primary_resource_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_branch_created_idx on bookings(branch_id, created_at desc);
create index bookings_customer_idx on bookings(customer_id);
create index bookings_start_at_idx on bookings(start_at);
create index bookings_contact_phone_idx on bookings(contact_phone);

-- Replaces the embedded `therapies: [{slug,label,role}]` array on each
-- booking. One row per therapy line item.
create table booking_therapies (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  therapy_slug text not null,
  label text,
  role text,
  duration_min int, -- per-booking override (e.g. Float 90-min), else therapy default
  position int not null default 0
);
create index booking_therapies_booking_idx on booking_therapies(booking_id);

-- Replaces the embedded `schedule: [{therapySlug,resourceId,from,to}]`
-- array. This is THE table that makes resource-conflict/overlap checking a
-- real indexed range query instead of an array scan — the single most
-- consequential change in this migration.
create table booking_schedule_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  therapy_slug text not null,
  resource_id uuid not null references resources(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  position int not null default 0
);
-- The hot-path query: "is resource X free between A and B" — a plain range
-- overlap (`starts_at < B and ends_at > A`) against this index.
create index booking_schedule_resource_range_idx on booking_schedule_items(resource_id, starts_at, ends_at);
create index booking_schedule_booking_idx on booking_schedule_items(booking_id);

create table calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  resource_id uuid references resources(id),
  therapy_slug text,
  scope text not null, -- 'branch' | 'resource' | 'therapy'
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index calendar_blocks_range_idx on calendar_blocks(starts_at, ends_at);

create table maintenance_blocks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id),
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index maintenance_blocks_resource_range_idx on maintenance_blocks(resource_id, starts_at, ends_at);

create table booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  status text not null default 'created',
  amount numeric not null default 0,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_payments_booking_idx on booking_payments(booking_id);

-- =====================================================================
-- Memberships
-- =====================================================================

create table memberships (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  plan jsonb not null default '{}'::jsonb, -- type, price, session count, validity, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  membership_id uuid references memberships(id),
  plan_name text,
  plan_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  sessions_remaining int,
  wallet_balance numeric,
  freeze_history jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_subscriptions_customer_idx on member_subscriptions(customer_id);

create table membership_usage (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references member_subscriptions(id) on delete cascade,
  booking_id uuid references bookings(id),
  therapy_slug text,
  consumed_at timestamptz not null default now()
);
create index membership_usage_sub_idx on membership_usage(subscription_id, consumed_at desc);

create table membership_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references member_subscriptions(id) on delete cascade,
  type text not null,
  amount numeric,
  note text,
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index membership_transactions_sub_idx on membership_transactions(subscription_id, created_at desc);

-- =====================================================================
-- Commerce — coupons, gift cards, products, payments, invoices
-- =====================================================================

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null, -- 'percent' | 'flat'
  discount_value numeric not null,
  applicable_therapies text[] not null default '{}',
  applicable_branches uuid[] not null default '{}',
  first_time_only boolean not null default false,
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit int,
  usage_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  booking_id uuid references bookings(id),
  customer_id uuid references customers(id),
  subtotal_inr numeric,
  discount_inr numeric,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on coupon_redemptions(coupon_id);

create table giftcards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  pin text,
  balance numeric not null default 0,
  status text not null default 'active',
  claimed_by_customer_id uuid references customers(id),
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Replaces the embedded `redemptions: [{bookingId,bookingRef,amount,at}]`
-- array pushed onto each giftcard doc.
create table giftcard_redemptions (
  id uuid primary key default gen_random_uuid(),
  giftcard_id uuid not null references giftcards(id) on delete cascade,
  booking_id uuid references bookings(id),
  booking_ref text,
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index giftcard_redemptions_card_idx on giftcard_redemptions(giftcard_id);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references product_categories(id),
  name text not null,
  price numeric not null default 0,
  stock int not null default 0,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence invoice_number_seq start 1;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint not null default nextval('invoice_number_seq'),
  booking_id uuid references bookings(id),
  customer_id uuid references customers(id),
  amount numeric not null default 0,
  status text not null default 'issued',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  customer_id uuid references customers(id),
  amount numeric not null default 0,
  method text,
  status text not null default 'captured',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id),
  booking_id uuid references bookings(id),
  amount numeric not null default 0,
  status text not null default 'pending',
  reason text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Loyalty — wallet + referrals
-- =====================================================================

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  type text not null,
  points int not null default 0,
  amount_inr numeric,
  note text,
  ref text,
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index wallet_transactions_customer_idx on wallet_transactions(customer_id, created_at desc);

create table referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references customers(id),
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid references customers(id),
  referred_customer_id uuid references customers(id),
  referral_code_id uuid references referral_codes(id),
  total_inr numeric not null default 0,
  referrer_reward numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index referrals_referrer_idx on referrals(referrer_customer_id);

-- =====================================================================
-- Customer auth (OTP)
-- =====================================================================

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  otp_hash text not null,
  attempts int not null default 0,
  used boolean not null default false,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index otp_phone_created_idx on otp_codes(phone, created_at desc);

-- =====================================================================
-- CMS / content (generic CRUD today — data jsonb + a few indexed columns)
-- =====================================================================

create table pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pages_updated_idx on pages(updated_at desc);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mini_blog_posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  "order" int not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mini_blog_order_idx on mini_blog_posts("order", created_at desc);

create table outcome_therapy_map (
  id uuid primary key default gen_random_uuid(),
  outcome_slug text not null unique,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  kind text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  team_size text,
  notes text,
  source text default 'unknown',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index leads_created_idx on leads(created_at desc);

-- =====================================================================
-- Settings / integrations / comms / activity log
-- =====================================================================

-- Replaces the polymorphic Mongo `settings` collection (key: 'bookingRules'
-- | 'loyalty' | 'scheduling' | 'analytics' | 'business' | ...).
create table app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

-- Replaces the polymorphic Mongo `integrations` collection (key: 'razorpay'
-- | 'whatsapp' | 'bhashsms' | 'gallabox' | ...). Holds provider credentials
-- — same sensitivity as the current Mongo docs; access already server-only.
create table integrations (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  key text,
  channel text, -- 'whatsapp' | 'sms' | 'email'
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  channel text,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on activity_log(created_at desc);
create index activity_log_actor_idx on activity_log(actor_id);
