# Merchant catalog and inventory security model

SNPL schedules an **attempt to purchase**. It does not reserve inventory, provide queue priority, or guarantee purchase. It is not credit. SNPL Flex is a future, separate financing concept that could purchase immediately; it is out of scope.

## Scheduling-time authority

A future merchant adapter must authoritatively verify that the product exists, is public/published, purchasable, in stock, has sufficient quantity, is SNPL-eligible, and is permitted by the merchant. Client-supplied IDs never establish eligibility. Hidden, draft, staged, unreleased, excluded, or limited-release products must be rejected even when their IDs are known.

The current demo catalog already uses server-side product lookup, active status, price, quantity and total validation. This is not a substitute for merchant authority.

## Execution-time authority

Immediately before purchase, the merchant adapter must recheck publication, purchasability, eligibility, stock, quantity, current price, merchant permission, and product/category exclusions. Failure means no charge and no purchase; record a safe failure state and eventually notify the customer.

V1 price policy is conservative: execute only at the exact scheduling-time price until a customer-facing maximum-price authorization is implemented. Never charge more than the explicit authorized maximum. A lower price may be allowed only when the merchant adapter and stored authorization model support it unambiguously.

## Anti-release-bot requirements for Merchant v1

- Merchant-configurable product/category and limited-release exclusions.
- Per-product quantity caps and per-account/product velocity.
- Merchant-level checkout and execution velocity limits.
- Launch/drop protection and unpublished-inventory rejection.
- Merchant-authoritative eligibility at scheduling and execution.
- No inventory reservation or priority semantics.
- Signed merchant webhooks/API credentials, tenant isolation, and audit trails.
