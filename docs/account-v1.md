# SNPL Account v1

## Configuration

1. Enable Phone authentication in Supabase Auth and configure an SMS provider.
2. Create a Cloudflare Turnstile widget for each deployed hostname. Set its public site
   key as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. In Supabase Dashboard, open Authentication > Bot and Abuse Protection, enable CAPTCHA,
   select Cloudflare Turnstile, and store the Turnstile secret there. The secret is held
   by Supabase and must never use a `NEXT_PUBLIC_` environment variable.
4. Configure production Auth rate limits before launch. The application rate limiter
   remains enabled as defense in depth.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the
   legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Public clients never receive the service-role key.
6. Apply `20260905120000_account_v1_cancellation.sql` through the normal reviewed
   migration pipeline before deploying the account UI.

## Architecture and security boundaries

- `@supabase/ssr` stores Auth sessions in cookies. Next.js `proxy.ts` refreshes and
  verifies claims for account navigation; pages and mutation handlers independently
  verify identity again.
- Phone OTP requests require a browser-generated Turnstile token. The server validates
  its shape and forwards it as Supabase Auth's `captchaToken`; Supabase verifies it with
  the configured secret. Challenges are reset after every request so they can be retried.
- Account pages query with the authenticated Supabase client, so the existing owner
  RLS policies on `accounts`, `orders`, and `scheduled_payments` remain authoritative.
- Checkout uses the same service-role persistence, SetupIntent binding, webhook, and
  scheduled executor paths. It now writes the verified Auth subject to `orders.user_id`;
  anonymous checkout still writes `null`.
- Cancellation is a server-only RPC. It locks the scheduled payment and its order and
  only changes both from `scheduled` to `cancelled` when ownership matches and processing
  has not begun. It cannot change amount, product, customer, or payment-method fields.
- Saved cards are retrieved from Stripe on the server. Only brand, last four digits,
  and expiration are rendered after the payment method's Stripe customer is matched to
  the owned order.

## Intentionally deferred

- Historical anonymous orders are not claimed or migrated.
- Adding, removing, or replacing payment methods is read-only until the execution model
  supports those mutations without weakening customer/payment-method binding.
- Account deletion, export, and automated retention controls remain follow-up work.
