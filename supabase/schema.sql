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
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), name text not null, category text, summary text, availability_note text, sort_order int not null default 0, published boolean not null default false
);
create table if not exists public.website_services (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), slug text unique not null, name text not null, summary text, body text, sort_order int not null default 0, published boolean not null default false
);

alter table public.website_inquiries enable row level security;
alter table public.website_projects enable row level security;
alter table public.website_gallery enable row level security;
alter table public.website_equipment enable row level security;
alter table public.website_services enable row level security;

-- Public can submit inquiries but cannot read them.
drop policy if exists "public_insert_inquiries" on public.website_inquiries;
create policy "public_insert_inquiries" on public.website_inquiries for insert to anon,authenticated with check (true);
drop policy if exists "admin_manage_inquiries" on public.website_inquiries;
create policy "admin_manage_inquiries" on public.website_inquiries for all to authenticated using (public.is_website_admin()) with check (public.is_website_admin());

-- Public website can read published content; admins can manage all content.
do $$ declare t text; begin
  foreach t in array array['website_projects','website_gallery','website_equipment','website_services'] loop
    execute format('drop policy if exists "public_read_published" on public.%I',t);
    execute format('create policy "public_read_published" on public.%I for select to anon,authenticated using (published = true or public.is_website_admin())',t);
    execute format('drop policy if exists "admin_manage" on public.%I',t);
    execute format('create policy "admin_manage" on public.%I for all to authenticated using (public.is_website_admin()) with check (public.is_website_admin())',t);
  end loop;
end $$;

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
