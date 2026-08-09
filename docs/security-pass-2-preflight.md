# Security Pass #2 database preflight

Read-only inspection of the connected Supabase project on 2026-08-09 found:

- No duplicate non-null `scheduled_payments.order_id` values.
- No null schedule `order_id`, date, status, currency, or payment-method values.
- One legacy scheduled-payment row has a null amount. It is not modified or deleted; the migration leaves the column nullable but adds a `NOT VALID` check that rejects new null/non-positive amounts.
- Thirty-two legacy orders have all three modern checkout-integrity fields null. No partially populated group was found. The migration enforces all-or-none consistency without fabricating legacy values.
- Order Stripe customer, total and status values had no nulls and are tightened to `NOT NULL`.

Before applying the migration in any environment, rerun the duplicate and null preflight. The migration deliberately aborts if duplicate order schedules exist. Investigate and reconcile such rows manually; never select a winner or delete payment data automatically.

The Phase B migrations were compiled and behavior-tested in an isolated PGlite PostgreSQL environment. They have not been applied to the connected Supabase project by this branch.
