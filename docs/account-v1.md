# SNPL Account v1

## Final authentication architecture

- **Primary returning sign-in:** a discoverable passkey. No email address is requested
  before the WebAuthn ceremony.
- **First-time bootstrap:** a six-digit verification code sent by email.
- **Fallback and recovery:** the same verified email flow remains available when a
  passkey is unavailable.
- **Session:** `@supabase/ssr` stores the Supabase session in cookies. Next.js
  `proxy.ts` refreshes claims; protected pages and mutation handlers verify identity
  independently.

Supabase passkey support is currently **experimental** and its API may change without
notice. The browser client explicitly opts in with `auth.experimental.passkey: true`.

## Supabase Auth configuration

1. Enable Email authentication. Configure the email template to include `{{ .Token }}`
   so the bootstrap and recovery flow sends a six-digit code, and configure production
   SMTP delivery.
2. Open Authentication > Passkeys and enable **Passkey authentication** with exactly:
   - RP display name: `SNPL`
   - RP ID: `schedulenowpaylater.com`
   - Origin: `https://www.schedulenowpaylater.com`
3. Keep the RP ID stable. Changing it invalidates existing passkeys.
4. Create a Cloudflare Turnstile widget for every deployed hostname and set its public
   site key as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
5. Open Authentication > Bot and Abuse Protection, enable CAPTCHA, select Cloudflare
   Turnstile, and store the Turnstile secret in Supabase. The secret must never use a
   `NEXT_PUBLIC_` environment variable or otherwise reach the browser.
6. Configure production Supabase Auth rate limits. The application-level email-initiation
   limiter remains enabled as defense in depth.
7. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the
   legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Public clients never receive the service-role key.
8. Apply `20260905120000_account_v1_cancellation.sql` through the normal reviewed
   migration pipeline before deploying the account UI.

## Account and payment security boundaries

- Email initiation requires a browser-generated Turnstile token. The server validates
  its shape and forwards it as Supabase Auth's `captchaToken`; Supabase verifies it with
  the configured secret. The challenge resets after each initiation attempt.
- Passkey registration is offered only inside the protected account security page and
  requires a current authenticated session. Users can list and add their own passkeys.
- Account pages query with the authenticated Supabase client, so the existing owner RLS
  policies on `accounts`, `orders`, and `scheduled_payments` remain authoritative.
- Checkout uses the same service-role persistence, SetupIntent binding, webhook, and
  scheduled executor paths. It writes the verified Auth subject to `orders.user_id`;
  anonymous checkout still writes `null`.
- Cancellation is a server-only RPC. It locks the scheduled payment and its order and
  only changes both from `scheduled` to `cancelled` when ownership matches and processing
  has not begun.
- Saved cards are retrieved from Stripe on the server. Only brand, last four digits,
  and expiration are rendered after matching the Stripe customer to the owned order.

## Intentionally deferred

- Passkey rename and deletion are deferred while the Supabase passkey API remains
  experimental. Account v1 provides list and registration only.
- Historical anonymous orders are not claimed or migrated.
- Adding, removing, or replacing payment methods remains read-only until the execution
  model supports those mutations without weakening customer/payment-method binding.
- Account deletion, export, and automated retention controls remain follow-up work.
