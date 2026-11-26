# PROGRESS — Purchase Order & Supplier Shipment

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) · imported 2026-11-26 |
| Plan | [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) |
| Last updated | 2026-11-26 |
| Current phase | Phase 2 — Web and copy (server and contracts built) |
| Tasks done | 8 / 18 (6 more in progress) |
| Gates passed | 0 / 4 (G0 and G1 blocked on D1 and on running integration tests) |

## How to use this file

Resume protocol (every session): 1) read the AGENTS.md files and SPEC sections 1 to 3. 2) read this file. 3) continue at **Next action**.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts and Next action with each change. Never silently change SPEC.md; record deviations below.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> Review the PR. Then, in order: (1) full draft to receipt journey integration test (needs a seeded catalog helper, see TEST-PLAN); (2) e2e journey spec; (3) decide D1 (real transactions) before relying on posting in production. Edit form, shipments UI and payment-term management are done.

## Task status (from IMPLEMENTATION-PLAN)

| ID | Status | Evidence |
|---|---|---|
| P0-01 | [x] | Decision log below; party `assertActiveRole` reused, no SKU on items, money is bigint minor units |
| P0-02 | [~] | main now has real transactions (audit #13); PO repositories call `db.transaction`, so posting becomes atomic once the integration run confirms it |
| P0-03 | [~] | TEST-PLAN rows added; some layers not yet written |
| P0-04 | [x] | `purchase_order`, `purchase_shipment` in contracts registry; sidebar permission map has `purchaseOrder`; route tests assert 403 mapping |
| P1-01 | [x] | `assertActiveRole(orgId, partyId, "VENDOR")` in purchase-order service; service spec |
| P1-02 | [x] | `packages/contracts/src/{purchase-order,purchase-shipment,payment-term}`; contracts tests 234 pass |
| P1-03 | [-] | `DatePickerField` already existed in `@workspace/ui/blocks/form`; LineItems was reused unchanged, so no refactor was needed |
| P1-04 | [~] | Server done (lazy system seed, 20-term cap, custom codes). No management screen yet; create-only API hooks exist |
| P1-05 | [x] | Server, list, details, create and edit forms, confirm/close/cancel done |
| P1-06 | [x] | Migration `0022_purchase_orders` applied on pglite; `inventory_items.in_transit_qty` |
| P1-07 | [~] | Server post and reverse done with spec. No web UI |
| P1-08 | [-] | Receipt and AP modules do not exist yet; stable ids and `receivedBaseQty` fields are in place |
| P2-01 | [x] | List, create, edit, details, actions, shipments panel (create, post, reverse), payment-term screen done |
| P2-02 | [x] | Sidebar entry comes from the registry (`/purchase-orders`); routes added; abilities hide actions |
| P2-03 | [~] | `sync:i18n:check` passes, en and ar copy complete for built screens. RTL not reviewed visually |
| P3-01 to P3-03 | [ ] | Not started (P3-02 registry row updated) |

## Status board

| Phase | Title | Gate | Status |
|---|---|---|---|
| 0 | Discovery and decisions | G0 | done except D1 |
| 1 | Build | G1 | server done, integration run pending |
| 2 | Web and copy | G2 | in progress |
| 3 | Hardening and acceptance | G3 | not started |

## Decision log

| ID | Decision | Status | Owner response · date |
|---|---|---|---|
| D1 | Transaction-capable DB driver is available before posting use cases are built | resolved on main by audit #13 (Neon WebSocket pool); PO code already uses `db.transaction` | see `../SAAS-SPEC-FIXES-PLAN.md` D1. Built best-effort; see `docs/proposals/real-transactions.md` |
| D2 | Money is integer minor units: bigint in DB (number mode), strings in contracts, org default currency | decided (agent default, please confirm) | 2026-11-26 |
| D3 | Tax and discount rates are in v1 (user, 2026-11-26). SPEC defers tax to a tax module that does not exist, so rates are per-line basis points (`discountRateBps`, `taxRateBps`). Rate and fixed discount amount together returns 422 `PURCHASE_ORDER_DISCOUNT_CONFLICT`. Tax = rate of net, rounded half up per line; header totals sum lines. | decided (user scope, model is agent choice) | 2026-11-26 |
| D4 | PO number is max-suffix + 1 with insert retry on `number_taken` | decided, see `docs/proposals/document-sequences.md` | 2026-11-26 |
| D5 | System payment terms seed lazily per org; 20-term cap by count, insert, re-count, compensating delete; custom codes `CUSTOM_<SLUG>`; default term "Due on receipt"; term snapshotted on the PO at save and at confirm | decided | 2026-11-26 |
| D6 | Confirm adds ordered base qty to `onOrder`. Close sets `cancelledBaseQty` to the unshipped qty and releases onOrder. Cancel of a confirmed PO needs no shipment activity, else `HAS_FULFILLMENT`. Delete is draft only | decided | 2026-11-26 |
| D7 | Post moves onOrder to inTransit. Reverse needs POSTED and qty still in transit; on a closed or cancelled PO the qty goes to `cancelledBaseQty` instead of onOrder | decided | 2026-11-26 |
| D8 | Items have no SKU, so `itemSku` is always null | decided | 2026-11-26 |

## Deviations

- Posting is not atomic (D1). Confirm, shipment post and reverse write several rows in sequence. A failure midway can leave the projection out of step with the document.
- Integration tests were written but not run (no docker or Postgres in the build sandbox). The full draft to receipt journey is not yet covered by an integration test.
- Deviation from SPEC (D3): no `taxCodeId` or tax module, rates are inline basis points; no header-level discount.

## Verification log

| Date | Task | Command | Result |
|---|---|---|---|
| 2026-11-26 | P1-02 | `pnpm --filter @avuny/contracts exec vitest run` | 24 files, 234 tests pass |
| 2026-11-26 | P1-04..07 | `pnpm exec vitest run --project unit src/api/modules/{purchase-order,purchase-shipment,payment-term,inventory-projection}` (apps/server) | pass (service specs and mocked-service route tests) |
| 2026-11-26 | all server | `NODE_OPTIONS=--max-old-space-size=1400 pnpm turbo typecheck --filter=@avuny/books-server --concurrency=1` | pass |
| 2026-11-26 | P1-06 | all migrations applied to pglite | pass |
| 2026-11-26 | P2-01..03 | `pnpm exec tsc -b --noEmit`, `eslint` on new web code, `pnpm sync:i18n:check` (apps/web) | pass |
| 2026-11-26 | web unit | `VITE_API_URL=http://localhost:3000 pnpm exec vitest run` (apps/web) | 38 files, 141 tests pass |
| 2026-11-26 | server unit, whole suite | `pnpm exec vitest run --project unit` (apps/server) | 765 pass, 12 fail in auth, otp, geo and health; those files are unchanged on this branch and return 500 in the sandbox (runtime config missing). Not re-run on dev |
| 2026-11-26 | int | `*.routes.int.test.ts` for payment-term and purchase-order | written, NOT run (needs docker) |
| 2026-11-26 | e2e | none written; CI Web e2e (existing specs) passes | open |
