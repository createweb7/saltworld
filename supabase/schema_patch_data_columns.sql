-- Safety-net `data jsonb` catch-all on tables where real Mongo documents
-- carry fields beyond what the initial schema modeled explicitly (schema
-- drift accumulated organically over time with no migration discipline).
-- Explicitly-modeled columns stay the source of truth for anything queried
-- relationally; `data` holds the rest so migration never loses a field.

alter table branches add column if not exists data jsonb not null default '{}'::jsonb;
alter table users add column if not exists data jsonb not null default '{}'::jsonb;
alter table password_resets add column if not exists used_at timestamptz;
alter table password_resets add column if not exists data jsonb not null default '{}'::jsonb;
alter table customers add column if not exists data jsonb not null default '{}'::jsonb;
alter table notes add column if not exists data jsonb not null default '{}'::jsonb;
alter table therapies add column if not exists data jsonb not null default '{}'::jsonb;
alter table resources add column if not exists data jsonb not null default '{}'::jsonb;
alter table bookings add column if not exists data jsonb not null default '{}'::jsonb;
alter table calendar_blocks add column if not exists data jsonb not null default '{}'::jsonb;
alter table membership_transactions add column if not exists data jsonb not null default '{}'::jsonb;
alter table coupons add column if not exists data jsonb not null default '{}'::jsonb;
alter table coupon_redemptions add column if not exists data jsonb not null default '{}'::jsonb;
alter table giftcards add column if not exists data jsonb not null default '{}'::jsonb;
alter table product_categories add column if not exists data jsonb not null default '{}'::jsonb;
alter table wallet_transactions add column if not exists data jsonb not null default '{}'::jsonb;
alter table referral_codes add column if not exists data jsonb not null default '{}'::jsonb;
alter table referrals add column if not exists data jsonb not null default '{}'::jsonb;
alter table otp_codes add column if not exists data jsonb not null default '{}'::jsonb;
alter table leads add column if not exists data jsonb not null default '{}'::jsonb;
alter table membership_usage add column if not exists data jsonb not null default '{}'::jsonb;
alter table booking_therapies add column if not exists data jsonb not null default '{}'::jsonb;
