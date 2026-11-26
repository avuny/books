# SaaS Monetization — Spec Fixes & Prerequisites Plan

> **Version**: 1.0 · 2026-11-26
> **Companion to**: `docs/modules/IMPLEMENTATION-PLAN.md` (run this plan **before** its Phase 1)
> **Basis**: review of `dev` @ `73a31e9` — the six SaaS docs checked against the real schema, db client, wrangler config, and existing modules.

**How to execute**: phases run in order. Phase 0 is owner decisions — nothing below starts until they are recorded. Each task is self-contained: file paths, the change, and a done-when check. Do not start the main plan's Phase 1 (contracts) until Phases 0–2 here are done; contracts written against unfixed specs get rewritten.

---

## Phase 0 — Decisions the owner must make first

Record each answer at the top of `docs/modules/SAAS-OVERVIEW.md` as a Decisions section.

| # | Decision | Options | Recommendation | Unblocks |
|---|----------|---------|----------------|----------|
| D1 | Database driver for real transactions | (a) `@neondatabase/serverless` over WebSocket (`drizzle-orm/neon-serverless`); (b) postgres.js via Cloudflare Hyperdrive | **(a)** — smallest change, one driver for prod and the existing local test proxy | Phase 2, Phase 3 schema, the main plan's Phase 6.4 locking |
| D2 | Money representation | Confirm repo rule: `money()` bigint minor units + `currency()` char(3) in schema; minor-unit **strings** in DTOs | Confirm — the specs' `numeric(12,2)` is the outlier, `_helpers.ts:57` and accounting already use minor units | All Phase 1 spec edits |
| D3 | Immediate-cancellation compensation | (a) Account credit (never expires); (b) Partial Stripe refund | **(a)** — no refund fees, matches the existing "credits never expire" rule | Task 1.8 |
| D4 | Per-plan audit-log retention | (a) Visibility window (read filter); (b) Deletion job | **(a)** — activity-log is deliberately append-only; deleting audit history is a compliance hazard in an ERP | Task 1.19 |
| D5 | `maxAdjustmentsPerMonth` cap | (a) Keep with exclusions; (b) Drop the limit | **(a)** — exclude opening-balance and system-generated adjustments, warn before blocking. Blocking stock corrections creates wrong inventory | Task 1.19 |
| D6 | Billing currency & Egypt | (a) USD-only via Stripe at launch, MENA processor (Paymob/Fawry) on the roadmap; (b) local processing now | **(a)** — but verify Stripe Tax support for Egypt's 14% VAT before charging Egyptian cards; many Egyptian cards block or surcharge USD | Go-to-market, not Phase 1 code |
| D7 | Enterprise "custom" plans | (a) Exclude from self-serve v1; (b) build admin grant flow now | **(a)** — state it in the specs; an admin grant flow can reuse the existing admin module post-launch | Task 1.17 |
| D8 | Plan versioning | (a) v1 rule: "changes apply at renewal"; (b) full plan versions (`plans.version`, `subscriptions.plan_version_id`) | **(a)** — versioning columns are real schema work for a promise no v1 customer will exercise | Task 1.7, Phase 3 |

---

## Phase 1 — Spec amendments (docs only)

Independent edits; batch them per file. All paths under `docs/modules/`.

### 1.1 Money columns → minor units
- **Files**: `plan/SPEC.md`, `subscription/SPEC.md`, `payment/SPEC.md`, `billing/SPEC.md`, `SAAS-OVERVIEW.md`
- **Change**: every monetary column declared `numeric(12,2)` becomes `money()` (bigint minor units) + `currency()` per `packages/db/src/schema/_helpers.ts:57`. Every DTO amount becomes a minor-unit string with a currency code alongside (e.g. `amountMinor: string, currency: string`). State the rule once per spec's data-model section.
- **Done when**: `grep -rn "numeric(12,2)" docs/modules` returns nothing; each spec states the minor-unit rule.

### 1.2 Fix usage-counter SQL against the real schema
- **File**: `feature-gate/SPEC.md` §3.2 counter table
- **Change**: no table in this codebase has `deleted_at`. Rewrite each counter:
  - items → `WHERE org_id = ? AND is_active` (`packages/db/src/schema/item/item.ts:85`)
  - warehouses, warehouse_locations → `is_active` (`packages/db/src/schema/warehouse/warehouse.ts:92,177`)
  - customers / vendors → join `party_roles` on role + `is_active` (`packages/db/src/schema/party/parties.ts:112`); parties themselves have no soft-delete flag
  - unit_collections → no flag; count all org rows
- **Done when**: no counter references `deleted_at`; every counter names a real table and column.

### 1.3 Split the member limit
- **File**: `feature-gate/SPEC.md` §3.2
- **Change**: `organization_users` has three types (`owner` / `managed` / `portal`, `packages/db/src/schema/organization/organizations.ts:27-29,127-133`). Replace `maxMembers` with `maxManagedMembers` (type `owner`+`managed`) and `maxPortalMembers` (type `portal`), so external portal users never eat the member limit. Update the seed limit keys accordingly.
- **Done when**: both keys exist with their type filters; `maxMembers` is gone.

### 1.4 Give checkLimit a scope
- **File**: `feature-gate/SPEC.md` §3.1 interface (line ~72) and §4.1 (line ~144)
- **Change**: signature becomes `checkLimit(scope: { orgId?: string; userId?: string; warehouseId?: string }, limitKey)`. Register the required scope per key: `maxOrganizations` → `userId` (it counts organizations a user owns); `maxLocationsPerWarehouse` → `warehouseId`; all others → `orgId`. Fix §4.1, which currently passes a `userId` into the org-scoped signature.
- **Done when**: interface, counter table, and integration table agree on scopes.

### 1.5 Three-valued accounting feature
- **Files**: `plan/SPEC.md` (accounting is enum `none|basic|full`, line ~106), `feature-gate/SPEC.md`
- **Change**: add `getFeatureValue(featureKey): boolean | string` to the gate interface; `hasFeature()` stays boolean for plain features. Write down exactly what "basic" accounting includes and excludes in the plan SPEC.
- **Done when**: the gate can answer the enum, and "basic" has a written definition.

### 1.6 One active subscription = partial unique index
- **File**: `subscription/SPEC.md`
- **Change**: replace "orgId unique" with: partial unique index on `org_id WHERE status IN ('created','trialing','active','past_due','canceling')`. Canceled/expired rows are history; re-subscribing inserts a new row.
- **Done when**: spec states the partial unique index and the history rule.

### 1.7 Trial eligibility lives on the organization
- **File**: `subscription/SPEC.md`
- **Change**: record trial consumption on `organizations` (`trial_used_at timestamptz`, Phase 3 adds it), not on the subscription row, which becomes history on cancel. `SUBSCRIPTION_TRIAL_ALREADY_USED` checks the organization.
- **Done when**: spec names the organizations column and the check.

### 1.8 Cancellation compensation per D3
- **Files**: `subscription/SPEC.md` §3.2.6 (partial refund promise), `billing/SPEC.md` §3.3 (credits for proration remainders)
- **Change**: one mechanism. Recommended: proration remainder becomes a credit; delete the partial-refund promise.
- **Done when**: both specs name the same mechanism.

### 1.9 Plan versioning per D8
- **File**: `plan/SPEC.md` §5.2 (line ~142)
- **Change** (recommended path): replace "changes create a new plan version" with "changes apply at renewal; existing subscriptions keep current terms until then". If D8 chose full versioning: add `version` to plans and `plan_version_id` to subscriptions in Phase 3 instead.
- **Done when**: §5.2 matches D8.

### 1.10 Grace-period storage
- **Files**: `feature-gate/SPEC.md` (30-day over-limit grace after downgrade), `subscription/SPEC.md`
- **Change**: grace gets storage: `limits_grace_until timestamptz` on `organizations` (Phase 3). Over-limit resources are read-only until that date; cleared by the Phase 4.1 cron or on upgrade.
- **Done when**: spec names the column and who sets/clears it.

### 1.11 Webhook idempotency table
- **File**: `payment/SPEC.md` webhooks section
- **Change**: add `stripe_events` (`event_id text unique`, `type`, `processed_at`, `payload jsonb`), written **before** any handler logic; every webhook handler (subscription, invoice, payment, refund) dedupes through it. `stripeEventId` on `subscription_events` stays as domain data, not dedup.
- **Done when**: spec describes the table and the write-before-handle rule.

### 1.12 Out-of-order webhooks
- **File**: `payment/SPEC.md` or `subscription/SPEC.md`
- **Change**: define the protection: either monotonic subscription status transitions, or compare the Stripe event's `created` timestamp and discard events older than the last applied one, so a late `invoice.payment_failed` cannot regress an active subscription to `past_due`.
- **Done when**: the rule is written with the state order or timestamp check.

### 1.13 Effective-limit math
- **File**: `feature-gate/SPEC.md`
- **Change**: write the merge order: effective limit = plan limit + Σ(addon increment × quantity); enterprise metadata override replaces the result last.
- **Done when**: SPEC contains the formula and order.

### 1.14 Monthly counters in the org timezone
- **File**: `feature-gate/SPEC.md` §3.2 (`maxAdjustmentsPerMonth`)
- **Change**: calendar month = the organization's timezone (`organizations.timezone` exists), not UTC.
- **Done when**: the counter spec says org-local month.

### 1.15 GATE-CHECK endpoint
- **Files**: `feature-gate/SPEC.md` §5.1, `IMPLEMENTATION-PLAN.md` Phase 2.3
- **Change**: add the single-key check route to the plan's Phase 2 routes (recommended) or remove §5.1 from the spec.
- **Done when**: plan and spec list the same routes.

### 1.16 Default payment-method removal
- **File**: `payment/SPEC.md`
- **Change**: while a subscription is active, removing the default method requires naming the replacement default in the same call (no silent reassignment to most-recent). `PAYMENT_METHOD_IN_USE` keeps blocking removal of the last method.
- **Done when**: spec states the rule.

### 1.17 Enterprise flow per D7
- **Files**: `SAAS-OVERVIEW.md`, `subscription/SPEC.md`
- **Change** (recommended): state enterprise/custom plans are excluded from self-serve v1; `SUB-CREATE` rejects a custom price with a clear error; admin grant flow is a post-launch item.
- **Done when**: no spec promises a custom-price path.

### 1.18 Trim the v1 feature seed to enforceable features
- **Files**: `plan/SPEC.md` feature list, `IMPLEMENTATION-PLAN.md` Phase 1.7 seed
- **Change**: v1 seeds only features that can actually be gated: `customRoles`, `extraUnits`, `batchTracking` (module exists), `accounting`, plus the limits. Mark `salesOrders`, `purchaseOrders`, `invoicing`, `advancedReports` as future (not seeded — no modules exist; `inventory-reservation` has contracts and schema but no server module). Keep marketing rows (export formats, support levels) out of `plan_features`.
- **Done when**: seed list = enforceable list; the pricing page can never advertise a gate that does nothing.

### 1.19 Audit retention and adjustment cap per D4/D5
- **File**: `plan/SPEC.md` limit definitions
- **Change**: `auditLogRetentionDays` becomes a read visibility window, never a deletion job. `maxAdjustmentsPerMonth` (if kept) excludes opening-balance and system-generated adjustments and warns before blocking.
- **Done when**: both rules are written.

**Phase 1 gate**: `grep -rn "numeric(12,2)\|deleted_at IS NULL" docs/modules` is clean; D1–D8 recorded in `SAAS-OVERVIEW.md`; `IMPLEMENTATION-PLAN.md` Phase 1.6/1.7 task tables updated to include Phase 3 items below.

---

## Phase 2 — Real database transactions (code)

Depends on D1.

### 2.1 Switch the db client to a transaction-capable driver
- **File**: `packages/db/src/client.ts`
- **Change** (recommended option): import `drizzle` from `drizzle-orm/neon-serverless`, construct with the WebSocket client from `@neondatabase/serverless`, and **delete the `db.transaction` override** (the sequential fallback, lines ~50-58). Keep `LOCAL_NEON_PROXY_HOST` handling; the local neon proxy speaks WebSocket too.
- **Done when**: a test that writes two rows inside `db.transaction` and throws rolls back **both** rows; `pnpm --filter @avuny/db build` passes.

### 2.2 Verify advisory locks hold inside transactions
- **Files**: `apps/server/src/api/modules/organization/organization.repository.ts` (`lockOwner`, line ~101), plus the `pg_advisory_xact_lock` users in item, role, organization-user, accounting, unit-collection repositories
- **Change**: none if the driver is right — but verify: `pg_advisory_xact_lock` must run on the same connection as the transaction's statements (WebSocket driver does this; the HTTP driver could not, the lock released immediately per statement).
- **Done when**: two simultaneous organization creations by one owner serialize; integration suite passes: `docker compose -f apps/server/docker-compose.test.yml up -d --wait && pnpm --filter @avuny/books-server test:int`.

### 2.3 Remove no-transaction workarounds
- **Files**: any module that compensates for missing rollback with sequential writes + manual cleanup
- **Change**: simplify to real transactions where present.
- **Done when**: no comment or override claims "No transactions support in neon-http driver".

---

## Phase 3 — Schema additions (fold into the main plan's Phase 1.6)

- **Files**: `packages/db/src/schema/billing/*.ts` (new), `packages/db/src/schema/organization/organizations.ts`
- **3.1** `organizations`: add `trialUsedAt` and `limitsGraceUntil` (both `timestamptz`, nullable).
- **3.2** `subscriptions`: partial unique index on `org_id` for the five active statuses (1.6); `planVersionId` only if D8 chose full versioning.
- **3.3** `stripe_events` table per 1.11.
- **3.4** All money columns via `money()` + `currency()` from `_helpers.ts` per 1.1.
- **Done when**: `pnpm --filter @avuny/db db:generate` produces one migration with all of the above; the partial unique index appears in the SQL; `db:migrate` applies cleanly.

---

## Phase 4 — Cloudflare Workers runtime (before the main plan's Phases 2–3)

### 4.1 Cron Triggers
- **File**: `apps/server/wrangler.jsonc` (currently no `triggers` key)
- **Change**: add `"triggers": { "crons": [...] }` for trial-ending reminders (daily) and grace-period expiry (daily). Prefer Stripe webhooks where Stripe offers one (`customer.subscription.trial_will_end`).
- **Done when**: `wrangler deploy --dry-run` parses; each cron has a documented handler.

### 4.2 Plan-cache strategy
- **Files**: `feature-gate/SPEC.md` caching section, `apps/server/src/api/modules/organization/deps.ts:20` (DummyCache today)
- **Change**: pick one: (a) no cache for v1 (recommended — measure first), (b) Cloudflare KV, (c) Cache API. Remove "5-minute in-memory cache" from the spec: it is not consistent across isolates.
- **Done when**: spec and code agree; no module ships an in-memory org/plan cache.

### 4.3 Stripe SDK on Workers
- **File**: `payment/SPEC.md` (implementation note)
- **Change**: pin the SDK to its fetch HTTP client — `new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })` — so the default Node client never ships.
- **Done when**: SPEC carries the snippet.

### 4.4 Webhook raw body
- **File**: `payment/SPEC.md` (implementation note)
- **Change**: the Stripe webhook route must read the raw body for signature verification, mounted outside JSON parsing and auth middleware.
- **Done when**: SPEC carries the route-mounting requirement.

---

## Phase 5 — Cleanup (any time, do now)

- **5.1** Delete the debug log: `apps/server/src/api/modules/messaging/shell/messaging.service.ts:113` — `console.log("resend is called!!!!!!!!!!!!!!")`.
- **5.2** Resolve the org cache together with 4.2: `apps/server/src/api/modules/organization/deps.ts:20` wires `DummyCache`.
- **Done when**: `grep -rn "resend is called" apps/server/src` and the DummyCache wiring are gone.

---

## Execution notes for the agent

- Phase 1 tasks are independent doc edits; batch them per file. Phases 2–4 are sequential.
- After Phase 1, update `IMPLEMENTATION-PLAN.md` Phase 1.6/1.7 to include Phase 3 items, keeping one source of truth.
- Follow `AGENTS.md`: contracts first, `Result<T,E>` on services, `z` from `@avuny/zod`, run `pnpm typecheck` after each phase.
