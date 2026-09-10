-- Server-side helper functions (called via supabase-js .rpc()).

-- Atomically adjusts a customer's wallet balance and returns the new balance,
-- or NULL if the adjustment would take it below zero (caller treats NULL as
-- 'insufficient_balance'). Replaces the old Mongo find-then-updateOne pair in
-- lib/loyalty.js, which had a real race window under concurrent redemptions.
create or replace function adjust_wallet_balance(p_customer_id uuid, p_points int, p_now timestamptz)
returns numeric
language plpgsql
as $$
declare
  new_balance numeric;
begin
  update customers
  set wallet_balance = wallet_balance + p_points,
      updated_at = p_now
  where id = p_customer_id
    and wallet_balance + p_points >= 0
  returning wallet_balance into new_balance;
  return new_balance;
end;
$$;

-- Atomically bumps the three denormalized reporting counters coupons keep in
-- their `data` jsonb blob (totalRedemptions/totalRevenueInr/totalDiscountInr).
create or replace function increment_coupon_counters(p_coupon_id uuid, p_redemptions int, p_revenue numeric, p_discount numeric)
returns void
language sql
as $$
  update coupons
  set data = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(data, '{}'::jsonb),
        '{totalRedemptions}', to_jsonb(coalesce((data->>'totalRedemptions')::numeric, 0) + p_redemptions)
      ),
      '{totalRevenueInr}', to_jsonb(coalesce((data->>'totalRevenueInr')::numeric, 0) + p_revenue)
    ),
    '{totalDiscountInr}', to_jsonb(coalesce((data->>'totalDiscountInr')::numeric, 0) + p_discount)
  ),
  updated_at = now()
  where id = p_coupon_id;
$$;

-- Atomically decrements sessions_remaining and bumps the sessionsUsed
-- counter kept in `data` (sessions-type membership consumption).
create or replace function consume_subscription_session(p_subscription_id uuid)
returns setof member_subscriptions
language sql
as $$
  update member_subscriptions
  set sessions_remaining = coalesce(sessions_remaining, 0) - 1,
      data = jsonb_set(coalesce(data, '{}'::jsonb), '{sessionsUsed}', to_jsonb(coalesce((data->>'sessionsUsed')::int, 0) + 1)),
      updated_at = now()
  where id = p_subscription_id
  returning *;
$$;

-- Atomically adjusts sessions_remaining and/or wallet_balance on a
-- subscription (admin manual adjustment).
create or replace function adjust_subscription_balances(p_subscription_id uuid, p_sessions_delta int, p_wallet_delta numeric)
returns setof member_subscriptions
language sql
as $$
  update member_subscriptions
  set sessions_remaining = coalesce(sessions_remaining, 0) + p_sessions_delta,
      wallet_balance = coalesce(wallet_balance, 0) + p_wallet_delta,
      updated_at = now()
  where id = p_subscription_id
  returning *;
$$;

-- Returns the next formatted invoice number (e.g. 'INV-000042'), atomically
-- advancing invoice_number_seq. Replaces the old Mongo findOneAndUpdate-on-a-
-- counters-doc pattern with a native Postgres sequence.
create or replace function next_invoice_number()
returns text
language sql
as $$
  select 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
$$;
