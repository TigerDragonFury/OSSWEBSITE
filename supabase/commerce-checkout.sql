-- OSS Marine cart, checkout and order management
-- Run after commerce-upgrade.sql.

begin;

alter table public.website_store_items add column if not exists sku text;
alter table public.website_store_items add column if not exists purchasable boolean not null default false;
alter table public.website_store_items add column if not exists max_order_quantity integer not null default 10;

create table if not exists public.website_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text,
  customer_email text,
  customer_phone text,
  amount_total numeric(15,2) not null,
  currency text not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','cancelled','refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','processing','ready','fulfilled','cancelled')),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  notes text
);

create table if not exists public.website_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.website_orders(id) on delete cascade,
  store_item_id uuid not null references public.website_store_items(id),
  title text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(15,2) not null check (unit_price >= 0),
  line_total numeric(15,2) not null check (line_total >= 0),
  currency text not null
);

alter table public.website_orders enable row level security;
alter table public.website_order_items enable row level security;
drop policy if exists "admin_manage_orders" on public.website_orders;
create policy "admin_manage_orders" on public.website_orders for all to authenticated
using (public.is_website_admin()) with check (public.is_website_admin());
drop policy if exists "admin_manage_order_items" on public.website_order_items;
create policy "admin_manage_order_items" on public.website_order_items for all to authenticated
using (public.is_website_admin()) with check (public.is_website_admin());
grant select,update on table public.website_orders to authenticated;
grant select on table public.website_order_items to authenticated;
create index if not exists website_orders_created_idx on public.website_orders(created_at desc);
create index if not exists website_orders_payment_idx on public.website_orders(payment_status,fulfillment_status);
create index if not exists website_order_items_order_idx on public.website_order_items(order_id);

create or replace function public.complete_website_order(
  p_order_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_payment_intent_id text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  already_paid boolean;
begin
  select payment_status = 'paid' into already_paid
  from public.website_orders where id = p_order_id for update;
  if not found then return false; end if;

  if not already_paid then
    update public.website_store_items product
    set stock_quantity = greatest(0, product.stock_quantity - line.quantity), updated_at = now()
    from public.website_order_items line
    where line.order_id = p_order_id and line.store_item_id = product.id and product.stock_quantity is not null;
  end if;

  update public.website_orders set
    payment_status = 'paid', customer_name = p_customer_name, customer_email = p_customer_email,
    customer_phone = p_customer_phone, stripe_payment_intent_id = p_payment_intent_id, updated_at = now()
  where id = p_order_id;
  return true;
end;
$$;
revoke all on function public.complete_website_order(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.complete_website_order(uuid,text,text,text,text) to service_role;

commit;
