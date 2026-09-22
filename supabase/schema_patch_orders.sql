-- Adds retail order storage for the /products shopping section.
-- `products` / `product_categories` already exist (see schema.sql) but were
-- never wired to the app — this patch adds the missing `orders` /
-- `order_items` tables so a product purchase has somewhere to live,
-- mirroring the bookings/payments pattern already used for therapy bookings.
--
-- Claude Code cannot run DDL against this project directly (blocked by the
-- auto-mode classifier as "Modify Shared Resources") — paste this into the
-- Supabase SQL editor (or `psql "$SUPABASE_DB_URL" -f supabase/schema_patch_orders.sql`
-- from a terminal outside Claude Code) to apply it.

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references customers(id),
  contact_name text,
  contact_phone text,
  contact_email text,
  shipping_address jsonb not null default '{}'::jsonb,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'payment_pending', -- payment_pending | paid | packed | shipped | delivered | cancelled
  payment jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  price numeric not null default 0,
  qty int not null default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists orders_customer_idx on orders(customer_id);
