# OSS Marine Website V4

Complete responsive multi-page static website with optional Supabase CMS/admin integration.

## Included
- Home
- About
- Services overview + 6 individual service pages
- Projects + container refurbishment case study
- Fleet & Equipment
- Marine Store for vessels, heavy equipment, inventory and spares
- HSE & Quality
- Gallery
- Contact / RFQ
- Privacy + Terms
- Mobile navigation and fixed mobile Call / Request Quote actions
- Supabase RFQ storage
- Supabase-ready Projects, Gallery, Equipment and Services tables
- Responsive administration control centre under `/admin/`
- Enquiry search, filters, status workflow, details and CSV export
- ERP-backed project, vessel, heavy-equipment and store publishing
- Gallery image picker and Supabase media uploads
- Collapsible product descriptions, persistent shopping cart and Stripe-hosted checkout
- Store order and fulfillment management in the administration control centre
- `supabase/schema.sql`

## Supabase setup
1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. When sharing the Supabase project with the OSS ERP, run `supabase/erp-website-integration.sql` to protect ERP tables and enable approved publication from ERP records.
4. Run `supabase/commerce-upgrade.sql` to add the public store projection, image storage and inventory publishing access.
5. Run `supabase/commerce-checkout.sql` to add purchasable listings, orders and order items.
6. Add the project URL and **anon/publishable key only** to `config.js`. Never put the service-role key in browser code.
7. Create an Auth user for the website administrator.
8. Assign that user's app metadata `role=admin` through a secure admin/server process.
9. Open `/admin/` and sign in.

## Online payments

Checkout uses Stripe's hosted payment page. Add these server-only environment variables to the Vercel project for Production, Preview and Development as required:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` (set to `https://www.offshoresupportservices.ae` in production)

Create a Stripe webhook pointing to `https://www.offshoresupportservices.ae/api/stripe-webhook` and subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`.

In Admin → Store, enter a positive price and stock quantity, then enable **Add to Cart and online payment** for products that can be bought online. Leave it disabled for quote-only vessels and equipment.

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
