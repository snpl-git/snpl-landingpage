# SNPL security operations

## Required production controls

The application uses the database RPC `consume_api_rate_limit` for atomic limits shared by all Vercel instances. Production fails closed if the RPC or migration is unavailable. Local development falls back to an in-process limiter and must never be treated as pilot-grade enforcement.

Configure Vercel Firewall rules as a coarse outer layer: block known malicious automation, apply a conservative per-IP request-rate rule to `/api/checkout/start` and `/api/subscribe`, and preserve the application limit as the authoritative resource-creation gate. A `429` response includes `X-SNPL-Challenge: required`; this is the integration point for a progressive challenge. Normal traffic should be invisible, suspicious traffic challenged, and clearly abusive traffic blocked.

Stripe configuration before a pilot:

- Enable Radar card-testing protections and alerts.
- Alert on SetupIntent, Customer, and failed authorization velocity.
- Review the ratio of Customers and SetupIntents to successfully authorized orders.
- Restrict all keys to their intended environments and maintain webhook endpoint signing.

## Alerts

Create alerts for these structured `kind=snpl_security` events:

- Any `rate_limit_unavailable`; more than 20 `rate_limit_blocked` in five minutes.
- More than 10 checkout creations per IP-derived key in ten minutes or an abnormal global increase.
- Any webhook binding or ledger failure; five signature rejections in five minutes.
- Any scheduled-payment integrity/customer mismatch or charged-payment persistence failure.
- Payments processing longer than 15 minutes, more than one schedule per order, or retry count above three.
- A material increase in abandoned Stripe objects or the Stripe-object/order ratio.

Use a Vercel Log Drain or an error-monitoring integration for paging. Runtime Logs alone are a development fallback, not a pilot-ready alerting system.

## Retention and privacy

| Data | Purpose | Recommended retention |
|---|---|---|
| Active orders and schedules | Payment authorization/execution and reconciliation | Merchant/legal requirement; define before pilot |
| Abandoned anonymous orders/SetupIntents/Customers | Retry and fraud investigation | Cancel/delete after 7 days if never authorized |
| Webhook event ledger | Replay protection and reconciliation | 90 days |
| API rate-limit buckets | Abuse control | Delete after expiry plus 24 hours |
| Failed payment diagnostics | Support and reconciliation | 90 days; sanitized codes only |
| Waitlist PII | Product communication | Until withdrawal or 12 months of inactivity |

Never log cookies, authorization headers, webhook signatures, client secrets, server secrets, raw Stripe/Supabase error objects, full payment-method IDs, customer PII, or card data.

No cleanup is activated against existing Production data in this change. Before pilot, schedule a reviewed cleanup job that cancels abandoned SetupIntents, deletes eligible demo Customers, and only then removes corresponding anonymous database records. Account v1 must add customer-visible ownership, export, deletion, and retention controls.

## Payment executor deployment gate

The versioned `supabase/functions/charge_due` source requires both Phase B migrations. Deploy it to a non-Production Supabase project first, run the adversarial suite and Stripe test-mode simulations, then separately authorize Production deployment. The GitHub workflow must never print the function response or headers.
