# Avuny Books SaaS Monetization Spec Review

**Reviewed:** 2026-11-26  
**Repository basis:** `dev` branch at commit `73a31e9`  
**Scope:** SaaS overview, implementation plan, and plan, subscription, payment, billing, and feature-gate specifications. No repository files were changed during the review.

## Summary

The overall approach is sound: contracts-first development, dependency injection, webhook signatures and idempotency, and phased implementation fit the existing project. The main risk is starting contracts and schemas before settling transaction support and the money representation used by the repository.

## Resolve before implementation begins

1. **Database transactions:** The current database client substitutes sequential statements for transactions, so writes can partially succeed and locks do not stay held. Select a transaction-capable driver before designing billing schemas or relying on database locking. Subscription/event, invoice/line-item, and payment/refund operations need atomicity.
2. **Money representation:** Current SaaS specifications use decimal currency amounts, while the codebase convention is integer minor units in `bigint`, with amounts represented as minor-unit strings in DTOs. Align all specifications to the repository convention before writing contracts.
3. **Usage-counter queries:** The proposed filters refer to soft-delete or active-state columns that differ by table. Inventory records use active flags; parties are classified through role records; unit collections have neither kind of field. Rewrite each counter against the actual schema.
4. **Limit-check scope:** A single organization ID cannot describe user-level organization caps or warehouse-level location caps. Make the check API accept the scope needed by each limit.
5. **Accounting feature levels:** The plan offers three accounting levels, but the feature gate is boolean. Define a value-returning gate or separate flags, and document what the middle tier includes.
6. **Member counting:** Organization users include owners, managed users, and portal users. Count the correct categories so external portal accounts do not consume the managed-user allowance.
7. **Active subscriptions:** Preserve canceled/expired subscription history while allowing a new subscription. Enforce uniqueness only across active statuses with a partial unique index.
8. **Trial eligibility:** Store trial-use history outside an individual subscription row so cancellation cannot make an organization eligible for another trial.
9. **Plan changes:** Either add schema and behavior for plan versions or make plan changes take effect at renewal and remove the unimplemented versioning promise.
10. **Workers runtime:** Avoid relying on isolate-local cache consistency. Decide whether to use shared caching or start without caching. Plan scheduled work using Workers cron triggers or appropriate Stripe events, use Stripe's fetch-compatible client, and mount signature-verified webhooks where the raw request body remains available.

## Product and ERP policy decisions

11. **Audit history:** Keep activity logs append-only. If tiers differ, apply a visibility window rather than deleting records.
12. **Inventory adjustment caps:** Corrections should remain possible. If a cap remains, exclude opening balances and system-generated entries, and warn before enforcing it.
13. **Egypt and regional payments:** Decide whether launch billing is USD-only or supports regional processing. Verify current Egypt VAT handling and card acceptance before launch; keep Saudi e-invoicing requirements in view for the future invoicing module.
14. **Cancellation compensation:** Choose one consistent treatment for unused time, such as account credit or a partial refund, and align subscription and billing specifications.
15. **Invoice numbering:** Choose Stripe-provided invoice numbers, or define a per-organization sequence backed by a unique constraint and retry behavior.
16. **Enterprise plans:** Either exclude custom plans from self-serve v1 or define an administrator-managed subscription grant flow.
17. **Feature matrix:** Seed only capabilities that can actually be enforced in the initial release. Mark future modules as future work rather than advertising nonfunctional gates.

## Engineering follow-up

18. Add a dedicated Stripe event ledger with a unique provider event ID, recording receipt before handler work so invoice, payment, and refund processing can be deduplicated.
19. Prevent stale webhook deliveries from moving subscription state backward, using monotonic transitions or provider event timestamps.
20. Specify limit computation order: plan allowance, add-on quantity increments, then enterprise overrides.
21. Calculate monthly usage windows using each organization's timezone.
22. Reconcile the single-feature gate-check endpoint in the specification and implementation plan, either adding it to the plan or removing it from the spec.
23. Require an explicit replacement default payment method before removing the current default from an active subscription.
24. Store the downgrade grace-period end date and define how scheduled or webhook-driven processing ends the period.
25. Remove the leftover debug log and decide on cache infrastructure together with the Workers cache approach.
26. Keep descriptive or marketing attributes, such as export formats and support levels, out of enforceable feature-gate seed data unless actual checks exist.

## Recommended order

First settle transaction support and minor-unit money handling. Then resolve product policies and correct the specifications. Only after the specs align should schema/contracts work begin. Address Workers-specific runtime design before implementing caching and scheduled billing behavior.