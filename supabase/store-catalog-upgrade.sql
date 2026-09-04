begin;

alter table public.website_store_items add column if not exists make text;
alter table public.website_store_items add column if not exists model text;
alter table public.website_store_items add column if not exists model_year integer;

create index if not exists website_store_items_make_idx
  on public.website_store_items (lower(make)) where published = true;
create index if not exists website_store_items_model_idx
  on public.website_store_items (lower(model)) where published = true;
create index if not exists website_store_items_catalog_idx
  on public.website_store_items (item_type, category, condition) where published = true;

commit;
