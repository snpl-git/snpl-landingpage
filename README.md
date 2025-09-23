# SNPL Holiday Landing (Next.js + Vercel + Resend)

A production-ready starter for the Schedule Now, Pay Later (SNPL) holiday landing page.

## Quick Start (Local)
1) `cp .env.example .env.local` and set:
   - `RESEND_API_KEY` (https://resend.com)
   - `OWNER_EMAIL` (where signup alerts go)
   - `SITE_URL` (e.g., http://localhost:3000 or your domain)
2) `npm install`
3) `npm run dev`
4) Open http://localhost:3000

## Deploy to Vercel
1) Create a new Vercel project and import this repo.
2) Add Environment Variables in Vercel:
   - `RESEND_API_KEY`
   - `OWNER_EMAIL`
   - `SITE_URL` (e.g., https://yoursite.com)
3) Set your GoDaddy domain to use Vercel (or move DNS to Cloudflare then CNAME to Vercel).
4) Ship it!

## Notes
- The waitlist form posts to `/api/subscribe` and will email both the visitor (confirmation) and you (notification).
- No database required for MVP. For persistence, add Neon/Supabase later.


---
## Supabase/Neon Persistence
1) Create a Supabase project (backed by Postgres; Neon-compatible).

2) In the SQL Editor, run `schema.sql` to create the `waitlist_signups` table and policies.

3) Copy the project URL and **Service Role** key to `.env.local`:

   - `SUPABASE_URL=...`

   - `SUPABASE_SERVICE_ROLE=...`

4) Deploy with these env vars set in Vercel. The API route writes signups server-side using the service role.

5) For analytics or dashboards later, consider adding a read-only policy and using the anon key on the client.

# snpl-landingpage
