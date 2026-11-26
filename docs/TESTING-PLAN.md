# Testing plan

Companion to [TESTING.md](./TESTING.md) (how the harness works). This file says **what** to test, **where**, and the standard every new module must meet. Audience: AI agents and developers.

## 1. Layers and tools

| Layer | Tool | Files | Command | DB | Use for |
|---|---|---|---|---|---|
| Unit | vitest (project `unit`) | `src/**/*.test.ts` | `pnpm --filter @avuny/books-server test` | none, fakes | services, mappers, validators, calculators, permission checker |
| Route integration | vitest (project `integration`) | `*.routes.int.test.ts` next to the module | `pnpm test:int` | real Postgres via docker-compose.test.yml | every endpoint: auth, permission, validation, tenancy, happy path, domain errors |
| Web unit/component | vitest | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @avuny/books-web test` | none | hooks, form schemas, pure UI logic |
| Web e2e | Playwright (chromium) | `apps/web/e2e/specs/*.e2e.ts` | `pnpm test:e2e` | real API on test DB | user journeys, one per module plus cross-module flows |
| Post-deploy smoke | Playwright against live URL | `apps/web/e2e/smoke/*.smoke.ts` (to create) | `pnpm test:smoke` (to create) | production, test org only | deploy regressions, see section 6 |

CI: `.github/workflows/tests.yml` runs unit, integration and e2e on PRs and pushes to main/dev. Rule: a PR cannot merge red, and `forbidOnly` stays on in CI.

## 2. Current coverage and gaps

Existing: route integration for `organization` and `party` only; e2e for `auth` and `organization`; about 100 unit tests across auth, otp, invitation, role/permission checker, item, unit, warehouse, inventory-adjustment, accounting.

Gap table. "P1" means write first (a bug in the 2026-11-26 audit or a money/stock-affecting path).

| Module | Integration (`*.routes.int.test.ts`) must cover | e2e journey | Pri |
|---|---|---|---|
| auth, otp | sign-up OTP, wrong/expired OTP, sign-in, refresh, logout, rate limit, forgot-password | sign-in errors, forgot-password, session survives reload, cookie works cross-origin | P1 |
| organization | create (atomic: no orphan row when username invalid, audit B1), slug conflict, settings update, country/currency defaults | create org, edit settings | P1 |
| organization-invitation | send, resend, revoke, accept new user, accept existing user, expired, wrong email, link host uses `WEB_APP_URL` (B6) | invite, accept, land in org with role | P1 |
| organization-user | list, change role, deactivate, cannot remove last owner | member management | P2 |
| role | CRUD, permission count persisted (B7), system roles immutable, cannot escalate | create role, assign, verify restricted UI | P1 |
| permissions (cross-cutting) | table-driven matrix: every route x role (owner, admin, viewer, custom, no membership, other tenant) expects 200/403/404 | restricted user cannot see or open forbidden screens | P1 |
| party (customer/vendor) | exists; add role add/remove, deactivate/reactivate, email duplicate, search/options | customers and vendors CRUD | P2 |
| unit, unit-collection | CRUD, conversion factors, in-use delete refused | create unit collection and unit | P2 |
| item-category | CRUD, tree, in-use delete refused | create category | P2 |
| item | create with/without opening stock (atomic, audit B2), idempotency on retry, tracking type, category required message (B8), deactivate | create item with opening stock, see per-location stock (B4) | P1 |
| warehouse, location | CRUD, system virtual locations hidden from user pickers (B9), default location | create warehouse and location | P2 |
| inventory-adjustment | draft, confirm, post (batch rules B3), cancel, negative stock policy, concurrency double-post | adjust stock up and down, ledger shows it | P1 |
| stock-movement, inventory-costing | ledger entries per posting, cost layers FIFO/average, reversal | movement list filters | P1 |
| batch | batch required only when tracked, expiry | pick batch on adjustment | P2 |
| accounting | accounts, journal balance (debits = credits), period lock | accounting pages (when added) | P2 |
| activity-log, audit | every mutating route writes an entry with actor, org, entity | log viewer (when added) | P3 |
| messaging | OTP and invite templates render real copy, no raw enums (B11) | none (capture outbox) | P2 |
| admin | platform-admin only routes reject normal users | none | P3 |
| i18n / RTL | key parity en/ar (`sync:i18n:check`), no raw keys rendered | Arabic switch, RTL screenshot of each list | P2 |
| a11y | axe scan on each list and dialog (`@axe-core/playwright`) | in each e2e | P3 |

## 3. Cross-cutting suites (write once, run for every module)

1. **Tenancy isolation**: for each module, create data in org A, call every read and write route as a user of org B. Expect 404 or 403, never data. Generate from the OpenAPI document so new routes are covered automatically.
2. **Permission matrix**: table of route x role, derived from the route's declared permission. Fails if a route has no declared permission.
3. **Contract conformance**: validate real responses against the OpenAPI schema (zod parse) in integration tests.
4. **Atomicity**: for each multi-write use case, inject a failure at step N and assert nothing persisted (needs real transactions, see TESTING.md known gap) or that compensation ran. Until transactions exist, assert idempotent retry.
5. **Idempotency**: posting endpoints take an idempotency key; replay returns the same result, no duplicate movement or journal.
6. **Concurrency**: two parallel posts of the same document; exactly one wins.
7. **Money**: amounts are bigint minor units, strings in DTOs; property tests for rounding and allocation sums.
8. **Audit and activity log**: each mutation emits one entry.

## 4. Standard for every new module or feature (definition of done)

A PR that adds or changes a module is not complete without all of the following. Agents copy [templates/TEST-PLAN.md](./templates/TEST-PLAN.md) into `docs/modules/<name>/TEST-PLAN.md` before coding and tick it while working.

- Unit tests for every service rule, state transition and calculator in the SPEC, named after the SPEC rule id.
- A `<name>.routes.int.test.ts` covering, for each endpoint: 401 unauthenticated, 403 without permission, tenant isolation, 422 validation, each domain error code, happy path, and audit entry.
- Seeded test builders in `apps/server/src/api/test-support` (create org, user, party, item, warehouse through real endpoints). No direct DB inserts except seed data.
- One e2e spec `apps/web/e2e/specs/<name>.e2e.ts` for the main journey plus one permission-denied journey. Copy comes from contracts locales via `e2e/support/copy.ts`, never hardcoded.
- For posting documents (orders, receipts, invoices, payments): reversal test, concurrency test, reconciliation test (projection equals sum of movements; journal balances).
- Locale parity (`pnpm --filter @avuny/books-web sync:i18n:check`), typecheck, lint, codegen clean (`pnpm codegen`, no diff).
- Regression test for every bug fixed: the test fails before the fix. Name it with the issue id.
- Coverage guide: services at least 85% lines, routes every endpoint hit. Do not chase a global number.
- Acceptance criteria in the SPEC each map to at least one named test (table in TEST-PLAN.md).

## 5. Bug to test traceability

Each audit finding (docs/audits/2026-11-26-app-audit.md) closes with a named test, for example: B1 `organization.routes.int.test.ts > create org with default username leaves no orphan`; B2 `item.routes.int.test.ts > opening stock failure does not leave an item`; B3 `inventory-adjustment > post for untracked item needs no batch`; B6 `invitation > link host equals WEB_APP_URL`; B7 `role > permission count matches saved grants`.

## 6. Post-deploy smoke test (deployment regression prevention)

Why: Cloudflare `wrangler deploy` replaces dashboard-set plain variables with the `vars` in `wrangler.jsonc`. A missing variable (CORS_ORIGINS, COOKIE_SAMESITE, WEB_APP_URL, NODE_ENV) breaks sign-in in the browser only, so server tests stay green. `vars` are now committed in git; the smoke test proves it on the live origin.

Run after the deploy job in `deploy.yml` (add a `smoke` job, `needs: deploy`), with a dedicated test account whose credentials are GitHub secrets (never in git):

1. `GET <API>/api/health` is 200.
2. Browser at the live web origin: sign in, expect the app shell, reload, still signed in (cookie SameSite=None, Secure, CORS credentials work).
3. Preflight check: `OPTIONS` on an API route with `Origin: <web origin>` returns that origin and `access-control-allow-credentials: true`.
4. Send an invitation to a capture address (or call the invitation preview endpoint) and assert the link host equals the web origin, not localhost.
5. Create and delete a customer in the smoke org (write path works).
Failure marks the deploy red and notifies the owner. Also add a CI check that `wrangler.jsonc` vars contain every non-secret key the env schema requires in production.

## 7. Order of work

1. Smoke test and wrangler vars check (section 6).
2. Cross-cutting suites 1 and 2 (tenancy, permission matrix).
3. P1 rows of section 2 in table order, each with its bug fix.
4. Then P2, and e2e a11y and RTL.
5. New modules (purchasing, sales) follow section 4 from day one.
