# SNPL Account v1

## Configuration

1. Enable Phone authentication in Supabase Auth and configure an SMS provider.
2. Configure CAPTCHA and production Auth rate limits before launch.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the
   legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Public clients never receive the service-role key.
4. Apply `20260905120000_account_v1_cancellation.sql` through the normal reviewed
   migration pipeline before deploying the account UI.

## Architecture and security boundaries

- `@supabase/ssr` stores Auth sessions in cookies. Next.js `proxy.ts` refreshes and
  verifies claims for account navigation; pages and mutation handlers independently
  verify identity again.
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
