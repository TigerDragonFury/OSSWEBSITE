-- OSS ERP -> public website integration
-- Run once in the Supabase SQL Editor for project lpryvdeyxnypdxyhbdkv.
-- The public website reads only website_* projection tables.

begin;

-- Never allow the public/anon role to query operational ERP records directly.
revoke all privileges on table public.vessels from anon;
revoke all privileges on table public.assets from anon;
revoke all privileges on table public.projects from anon;
revoke all privileges on table public.clients from anon;
revoke all privileges on table public.vendors from anon;
revoke all privileges on table public.inventory_items from anon;
revoke all privileges on table public.documents from anon;
revoke all privileges on table public.contracts from anon;
revoke all privileges on table public.leads from anon;
revoke all privileges on table public.company_settings from anon;

-- Website administrators may select the three ERP sources used for publishing.
-- Existing ERP policies for other authenticated roles remain untouched.
alter table public.vessels enable row level security;
alter table public.assets enable row level security;
alter table public.projects enable row level security;
grant select on table public.vessels, public.assets, public.projects to authenticated;

drop policy if exists "website_admin_read_vessels" on public.vessels;
create policy "website_admin_read_vessels" on public.vessels
for select to authenticated using (public.is_website_admin());

drop policy if exists "website_admin_read_assets" on public.assets;
create policy "website_admin_read_assets" on public.assets
for select to authenticated using (public.is_website_admin());

drop policy if exists "website_admin_read_projects" on public.projects;
create policy "website_admin_read_projects" on public.projects
for select to authenticated using (public.is_website_admin());

-- Public access remains limited to rows explicitly marked published.
grant select on table public.website_projects to anon, authenticated;
grant select on table public.website_equipment to anon, authenticated;
grant select on table public.website_gallery to anon, authenticated;
grant select on table public.website_services to anon, authenticated;

commit;
