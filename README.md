# OSS Marine Website V4

Complete responsive multi-page static website with optional Supabase CMS/admin integration.

## Included
- Home
- About
- Services overview + 6 individual service pages
- Projects + container refurbishment case study
- Fleet & Equipment
- HSE & Quality
- Gallery
- Contact / RFQ
- Privacy + Terms
- Mobile navigation and fixed mobile Call / Request Quote actions
- Supabase RFQ storage
- Supabase-ready Projects, Gallery, Equipment and Services tables
- Responsive administration control centre under `/admin/`
- Enquiry search, filters, status workflow, details and CSV export
- Project, gallery, equipment and service content editors
- `supabase/schema.sql`

## Supabase setup
1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Add the project URL and **anon/publishable key only** to `config.js`. Never put the service-role key in browser code.
4. Create an Auth user for the website administrator.
5. Assign that user's app metadata `role=admin` through a secure admin/server process.
6. Open `/admin/` and sign in.

## Hosting
This site is static and can be deployed to Cloudflare Pages, Vercel, Netlify, GitHub Pages, or any normal static host.

## Before public launch
- Replace representative Unsplash photos with OSS-owned/approved project images.
- Verify every published project/client name is approved for marketing use.
- Add your final domain to `sitemap.xml`, `robots.txt`, and `config.js`.
- Add spam protection (Cloudflare Turnstile recommended) to the public RFQ form before high-traffic launch.
- Confirm any certification/approval claims before publishing them.

## Company contact used
OSS Marine Services LLC
MW2, Mussafah Industrial City, Abu Dhabi, UAE
+971 50 260 6292
commercial@offshoresupportservices.ae
