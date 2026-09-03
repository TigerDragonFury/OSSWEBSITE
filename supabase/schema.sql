-- OSS Marine website schema for Supabase
-- Run in Supabase SQL editor, then create at least one Auth user.
-- Mark authorised admin users with app_metadata: {"role":"admin"} using a secure server/admin process.

create extension if not exists pgcrypto;

create or replace function public.is_website_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') = 'admin', false);
$$;

grant execute on function public.is_website_admin() to anon, authenticated;

create table if not exists public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  company text,
  email text not null,
  phone text,
  service text,
  project_location text,
  message text not null,
  source text default 'website',
  page text,
  status text not null default 'new' check (status in ('new','reviewing','quoted','won','lost','spam'))
);
create table if not exists public.website_projects (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  title text not null, category text, summary text, cover_image_url text, sort_order int not null default 0, published boolean not null default false
);
create table if not exists public.website_gallery (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), caption text, image_url text not null, sort_order int not null default 0, published boolean not null default false
);
create table if not exists public.website_equipment (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), name text not null, category text, summary text, availability_note text, source_kind text not null default 'asset', image_url text, sort_order int not null default 0, published boolean not null default false
);
create table if not exists public.website_services (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), slug text unique not null, name text not null, summary text, body text, sort_order int not null default 0, published boolean not null default false
);
create table if not exists public.website_store_items (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  source_id text not null, source_table text not null check (source_table in ('vessels','assets','inventory_items')),
  item_type text not null check (item_type in ('vessel','equipment','inventory')), title text not null, category text, summary text,
  image_url text, condition text, location text, price_amount numeric(15,2), currency text not null default 'AED',
  price_label text default 'Price on request', stock_quantity numeric, sku text,
  purchasable boolean not null default false, max_order_quantity integer not null default 10,
  featured boolean not null default false,
  published boolean not null default false, sort_order int not null default 0, unique(source_table,source_id)
);

create table if not exists public.website_orders (
  id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  customer_name text, customer_email text, customer_phone text,
  amount_total numeric(15,2) not null, currency text not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','cancelled','refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','processing','ready','fulfilled','cancelled')),
  stripe_session_id text unique, stripe_payment_intent_id text, notes text
);
create table if not exists public.website_order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.website_orders(id) on delete cascade,
  store_item_id uuid not null references public.website_store_items(id), title text not null, sku text,
  quantity integer not null check (quantity > 0), unit_price numeric(15,2) not null check (unit_price >= 0),
  line_total numeric(15,2) not null check (line_total >= 0), currency text not null
);

alter table public.website_inquiries enable row level security;
alter table public.website_projects enable row level security;
alter table public.website_gallery enable row level security;
alter table public.website_equipment enable row level security;
alter table public.website_services enable row level security;
alter table public.website_store_items enable row level security;
alter table public.website_orders enable row level security;
alter table public.website_order_items enable row level security;

-- Public can submit inquiries but cannot read them.
drop policy if exists "public_insert_inquiries" on public.website_inquiries;
create policy "public_insert_inquiries" on public.website_inquiries for insert to anon,authenticated with check (true);
drop policy if exists "admin_manage_inquiries" on public.website_inquiries;
create policy "admin_manage_inquiries" on public.website_inquiries for all to authenticated using (public.is_website_admin()) with check (public.is_website_admin());

-- Public website can read published content; admins can manage all content.
do $$ declare t text; begin
  foreach t in array array['website_projects','website_gallery','website_equipment','website_services','website_store_items'] loop
    execute format('drop policy if exists "public_read_published" on public.%I',t);
    execute format('create policy "public_read_published" on public.%I for select to anon,authenticated using (published = true or public.is_website_admin())',t);
    execute format('drop policy if exists "admin_manage" on public.%I',t);
    execute format('create policy "admin_manage" on public.%I for all to authenticated using (public.is_website_admin()) with check (public.is_website_admin())',t);
  end loop;
end $$;

drop policy if exists "admin_manage_orders" on public.website_orders;
create policy "admin_manage_orders" on public.website_orders for all to authenticated using (public.is_website_admin()) with check (public.is_website_admin());
drop policy if exists "admin_manage_order_items" on public.website_order_items;
create policy "admin_manage_order_items" on public.website_order_items for all to authenticated using (public.is_website_admin()) with check (public.is_website_admin());
grant select,update on table public.website_orders to authenticated;
grant select on table public.website_order_items to authenticated;

-- Optional seed content
insert into public.website_projects(title,category,summary,sort_order,published)
values ('Offshore Container Refurbishment','Refurbishment','Sa 2.5 blasting, structural repair, MPI, proof-load testing and certification support.',10,true)
on conflict do nothing;

-- Indexes used by the website and administration dashboard.
create index if not exists website_inquiries_created_at_idx on public.website_inquiries(created_at desc);
create index if not exists website_inquiries_status_idx on public.website_inquiries(status);
create index if not exists website_projects_sort_idx on public.website_projects(published,sort_order);
create index if not exists website_gallery_sort_idx on public.website_gallery(published,sort_order);
create index if not exists website_equipment_sort_idx on public.website_equipment(published,sort_order);
create index if not exists website_services_sort_idx on public.website_services(published,sort_order);
create index if not exists website_store_items_public_idx on public.website_store_items(published,featured,sort_order);
create index if not exists website_orders_created_idx on public.website_orders(created_at desc);
create index if not exists website_orders_payment_idx on public.website_orders(payment_status,fulfillment_status);
create index if not exists website_order_items_order_idx on public.website_order_items(order_id);

create or replace function public.complete_website_order(
  p_order_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text, p_payment_intent_id text
) returns boolean language plpgsql security definer set search_path = public as $$
declare already_paid boolean;
begin
  select payment_status = 'paid' into already_paid from public.website_orders where id = p_order_id for update;
  if not found then return false; end if;
  if not already_paid then
    update public.website_store_items product
    set stock_quantity = greatest(0, product.stock_quantity - line.quantity), updated_at = now()
    from public.website_order_items line
    where line.order_id = p_order_id and line.store_item_id = product.id and product.stock_quantity is not null;
  end if;
  update public.website_orders set payment_status = 'paid', customer_name = p_customer_name,
    customer_email = p_customer_email, customer_phone = p_customer_phone,
    stripe_payment_intent_id = p_payment_intent_id, updated_at = now()
  where id = p_order_id;
  return true;
end;
$$;
revoke all on function public.complete_website_order(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.complete_website_order(uuid,text,text,text,text) to service_role;

create or replace function public.set_website_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists website_projects_updated_at on public.website_projects;
create trigger website_projects_updated_at before update on public.website_projects
for each row execute function public.set_website_updated_at();
