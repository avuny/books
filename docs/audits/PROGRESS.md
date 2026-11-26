# Audit progress: 2026-11-26 app audit

Tracks work against [2026-11-26-app-audit.md](./2026-11-26-app-audit.md). Updated by Instinct on behalf of Khalid. Last updated: 2026-11-26 15:20 (Cairo).

Rule used: nothing goes to `main` directly any more. Each fix is a PR with a regression test where the code allows one.

## Done

| Row | Sev | What changed | Where |
|---|---|---|---|
| B0 | S1 | Production vars moved into `wrangler.jsonc` (already on `dev`, now on `main`). The first deploy after it still wiped the dashboard-set DATABASE_URL, ACCESS_TOKEN_SECRET, VERIFICATION_TOKEN_SECRET, OTP_SECRET and AUDIT_HMAC_SECRET (they were plain variables, not secrets), which took the API down for about an hour. Khalid re-added them and production recovered. | commit 1c9ef3c, incident noted below |
| B1 | S1 | Owner username is validated against the DB rule before any row is written, and the create-organization form derives a valid default handle. Test added. | commit 2cbbec3, pushed to `main` by request |
| B11 (title) | S3 | Page title is now "Avuny Books". | commit 2cbbec3 |
| B6 | S2 | `WEB_APP_URL` is set in `wrangler.jsonc`, so invitation links point at the web app. Not re-tested with a live invitation. | commit 1c9ef3c |
| B3 | S1 | New items default to batch tracking off (contract and form). | PR #4 (open, needs review) |
| B7 | S2 | Role list counts: the SQL compared against a bare `"id"` so every count was 0. Fixed, test on the generated SQL. | PR #5 (open, needs review) |

## Not done, and why

| Row | Why it is open |
|---|---|
| B2 (S1) | Item with opening stock is not atomic. The Neon HTTP driver has no transactions (docs/TESTING.md known gap). The real fix is a transaction-capable driver (Neon WebSocket pool or Hyperdrive). That changes the production DB connection and may need a pooled DATABASE_URL, so it waits for Khalid's OK. |
| B4 (S2) | Per-location inventory table is empty. Investigated, no code fix made. The read side checks out: the stock-balances query and the item stock summary both generate correctly qualified SQL (printed and checked), and the web tab passes the right filters. The most likely cause is B2: the item was created with opening stock, the "transaction" failed half way on the Neon HTTP driver, and the stock movement was written without the per-location projection rows. If that is right, B4 goes away once B2 is fixed (and the broken test item is cleaned up). Not confirmed against live data, I have no database access. Needs a repro on a fresh item after B3 and B2. |
| B5 (S2) | Sidebar "Accounting" link opens a 404. The entry comes from the shared module registry (`packages/contracts/src/modules/registry.ts`), and the sidebar option type is tied to it, so hiding it needs a deliberate change. Not started. |
| B8 to B10 (S2) | Item form required markers, TRANSIT location in the dropdown, country not driving currency and timezone. Not started. |
| B11 (rest), B12 to B15 (S3) | Six-decimal quantities, raw OTP enum text, raw permission group keys, missing aria-labels, Delete vs Deactivate wording, missing sidebar entries. Not started. |
| Sections 3 and 4 | Enhancements and new modules (purchasing, sales, accounting UI, reports, SaaS layer, and so on). Large product work, each needs its own spec and plan. Not started. |
| Live verification | B1, B3 and B7 are covered by unit tests only. None was exercised against the live database. |

## Test status in the sandbox

Contracts tests pass. In the sandbox the server unit suite has 12 failing tests and the web suite 10 failing files on unchanged `main` (missing env secrets and generated API files). Nothing new fails with these changes. The PR CI runs the full suite.

## Incident, 2026-11-26

Push to `main` at 13:29 (Cairo) deployed the Worker. The deploy replaced the dashboard-set variables with the `wrangler.jsonc` block, so five required values were undefined and the API returned HTTP 500 until about 14:38. Before the next deploy, keep these five as real Cloudflare secrets (`wrangler secret put NAME`) and keep non-secret values in `wrangler.jsonc`. Add the post-deploy smoke test from the audit (B0) so a broken deploy is caught in minutes.
