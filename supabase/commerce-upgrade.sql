-- OSS Marine commerce upgrade
-- Run once in the Supabase SQL Editor after erp-website-integration.sql.

begin;

-- Separate vessel and heavy-equipment website records and attach selected images.
alter table public.website_equipment add column if not exists source_kind text not null default 'asset';
alter table public.website_equipment add column if not exists image_url text;

-- Public catalogue projection. ERP tables remain the source of truth.
create table if not exists public.website_store_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_id text not null,
  source_table text not null check (source_table in ('vessels','assets','inventory_items')),
  item_type text not null check (item_type in ('vessel','equipment','inventory')),
  title text not null,
  category text,
  summary text,
  image_url text,
  condition text,
  location text,
  price_amount numeric(15,2),
  currency text not null default 'AED',
  price_label text default 'Price on request',
  stock_quantity numeric,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  unique(source_table,source_id)
);

alter table public.website_store_items enable row level security;
drop policy if exists "public_read_published" on public.website_store_items;
create policy "public_read_published" on public.website_store_items
for select to anon,authenticated
using (published = true or public.is_website_admin());
drop policy if exists "admin_manage" on public.website_store_items;
create policy "admin_manage" on public.website_store_items
for all to authenticated
using (public.is_website_admin())
with check (public.is_website_admin());
grant select on table public.website_store_items to anon,authenticated;
grant insert,update,delete on table public.website_store_items to authenticated;
create index if not exists website_store_items_public_idx on public.website_store_items(published,featured,sort_order);

-- Website administrators may browse ERP inventory when deciding what to list.
alter table public.inventory_items enable row level security;
grant select on table public.inventory_items to authenticated;
drop policy if exists "website_admin_read_inventory" on public.inventory_items;
create policy "website_admin_read_inventory" on public.inventory_items
for select to authenticated using (public.is_website_admin());

-- Public media bucket. Only website administrators may upload or manage objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('website-media','website-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "website_admin_upload_media" on storage.objects;
create policy "website_admin_upload_media" on storage.objects
for insert to authenticated
with check (bucket_id='website-media' and public.is_website_admin());
drop policy if exists "website_admin_update_media" on storage.objects;
create policy "website_admin_update_media" on storage.objects
for update to authenticated
using (bucket_id='website-media' and public.is_website_admin())
with check (bucket_id='website-media' and public.is_website_admin());
drop policy if exists "website_admin_delete_media" on storage.objects;
create policy "website_admin_delete_media" on storage.objects
for delete to authenticated
using (bucket_id='website-media' and public.is_website_admin());

commit;
