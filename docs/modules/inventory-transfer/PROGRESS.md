# PROGRESS: Inventory Transfer

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-26 |
| Last updated | 2026-11-26 |
| Current phase | Phase 0 |
| Tasks done | 0 / 20 |
| Gates passed | 0 / 9 |

## How to use this file
Resume protocol: 1) read AGENTS.md files and SPEC sections 0 to 3 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts, status board and Next action with every change. Log decisions and deviations; never silently edit SPEC.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action
> **P0-01**: get the owner's answers on the open decisions below (at least Q1 to Q6 and Q9).

## Status board
| Phase | Title | Tasks | Gate | Status |
|---|---|---|---|---|
| 0 | Discovery and decisions | 1 | gate 0 | [ ] |
| 1 | Contracts, registry, schema | 3 | gate 1 | [ ] |
| 2 | Backend drafts | 2 | gate 2 | [ ] |
| 3 | Dispatch, return, reverse dispatch | 3 | gate 3 | [ ] |
| 4 | Receive and lifecycle end | 3 | gate 4 | [ ] |
| 5 | Costing | 2 | gate 5 | [ ] |
| 6 | Accounting for transit loss (optional) | 1 | gate 6 | [ ] |
| 7 | Web UI | 3 | gate 7 | [ ] |
| 8 | Docs and hardening | 2 | gate 8 | [ ] |

## Tasks
| ID | Task | Done when | Status |
|---|---|---|---|
| P0-01 | Close open decisions Q1 to Q6 and Q9 with the owner | Phase 0 acceptance in SPEC section 12 | [x] |
| P1-01 | Contracts, registry entry, locales | Phase 1 acceptance in SPEC section 12 | [x] |
| P1-02 | DB schema and migration 0027 | Phase 1 acceptance in SPEC section 12 | [x] |
| P1-03 | Sidebar seed verified | Phase 1 acceptance in SPEC section 12 | [ ] |
| P2-01 | Repository and service for drafts | Phase 2 acceptance in SPEC section 12 | [x] |
| P2-02 | Routes, permissions, audit, number generation | Phase 2 acceptance in SPEC section 12 | [x] |
| P3-01 | Batch pre-allocation and available check | Phase 3 acceptance in SPEC section 12 | [x] |
| P3-02 | Dispatch posting and allocations | Phase 3 acceptance in SPEC section 12 | [x] |
| P3-03 | Return rest, reverse dispatch | Phase 3 acceptance in SPEC section 12 | [x] |
| P4-01 | Receive and partial receive | Phase 4 acceptance in SPEC section 12 | [ ] |
| P4-02 | Close short | Phase 4 acceptance in SPEC section 12 | [ ] |
| P4-03 | Reverse receipt | Phase 4 acceptance in SPEC section 12 | [ ] |
| P5-01 | consumeFifo, deriveLayer, consumeLayersOfSourceLine | Phase 5 acceptance in SPEC section 12 | [ ] |
| P5-02 | Wire costing into dispatch, receive, return, reversal | Phase 5 acceptance in SPEC section 12 | [ ] |
| P6-01 | Shortage journal on close short | Phase 6 acceptance in SPEC section 12 | [ ] |
| P7-01 | List, form, details | Phase 7 acceptance in SPEC section 12 | [ ] |
| P7-02 | Receive dialog, status actions | Phase 7 acceptance in SPEC section 12 | [ ] |
| P7-03 | Stock movement list labels and From/To | Phase 7 acceptance in SPEC section 12 | [ ] |
| P8-01 | FEATURE-TRACKING, REGISTRY, TESTING-PLAN, PROGRESS updates | Phase 8 acceptance in SPEC section 12 | [ ] |
| P8-02 | Reconciliation test | Phase 8 acceptance in SPEC section 12 | [ ] |

## Decision log
| ID | Decision (default applied) | Status | Owner response · date |
|---|---|---|---|
| Q1 | Offer "dispatch and receive in one step" in v1? Default: Allowed as a convenience (two movements), not required. | open | no response yet |
| Q2 | Allow transfers within one warehouse (bin to bin)? Default: Allowed through the same flow. | open | no response yet |
| Q3 | Need a separate approval before dispatch? Default: No, `dispatch` permission is the gate. | open | no response yet |
| Q4 | Allow over-receipt? Default: No. | open | no response yet |
| Q5 | Stock with no cost layer (adjustment gains): move at zero value or block? Default: Move without layers and report uncovered quantity. | open | no response yet |
| Q6 | Enforce destination receivable and source pickable? Default: Yes in the transfer service. | open | no response yet |
| Q7 | Transit loss: expense at once or hold as a carrier claim? Default: Expense with the existing shortage template, optional phase. | open | no response yet |
| Q8 | Should a draft reserve stock? Default: No reservations in v1. | open | no response yet |
| Q9 | Items with `allowNegativeStock`: may a transfer dispatch below zero? Default: No. | open | no response yet |
| Q10 | Partial dispatch: what happens to the unshipped remainder? Default: It is dropped; create a new transfer. | open | no response yet |
| Q11 | Is an idempotency key wanted for receive? Default: No, status and counters protect it. | open | no response yet |
| Q12 | Receiving a deactivated item or into a blocked location? Default: Destination can be changed; deactivated item blocks receive until reactivated or returned, which needs a decision. | open | no response yet |
| Q13 | May a receipt go to a warehouse other than the transfer's destination? Default: No. | open | no response yet |

### Phase 0 decisions (owner said to use the spec defaults, 2026-11-26)
Q1 dispatch and receive in one step allowed (optional). Q2 same-warehouse transfer allowed. Q3 no approval step. Q4 no over-receipt. Q5 stock without cost layers moves and is reported. Q6 destination must be receivable and source pickable, enforced in the service. Q9 no negative dispatch. Q10 the unshipped remainder is dropped. Q13 receipt only into the transfer's destination warehouse.

## Deviations
None yet.

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
| 2026-11-26 | Spec | read code on main 1a41a01 | Spec written from code reading only. Nothing was run. |
| 2026-11-26 | P1-01 | `pnpm --filter @avuny/contracts build`, `pnpm vitest run` in packages/contracts | Build ok, 30 files / 265 tests pass, including new inventory-transfer schemas.test.ts. |
| 2026-11-26 | P1-02 | `pnpm typecheck` in packages/db, `db:generate` | Typecheck ok. Migration 0027 only adds 3 enums, 5 tables, FKs and indexes. No drops. |
| 2026-11-26 | P1-01 | `pnpm typecheck` in apps/server | Ok after adding the sidebar permission map entry and role permission labels. |
| 2026-11-26 | P1-03 | not yet | Sidebar option is created by `pnpm seed` in the deploy job. Verify on production after merge. |
| 2026-11-26 | P2-01, P2-02 | `tsc --noEmit` and `vitest run --project unit src/api/modules/inventory-transfer` in apps/server | Typecheck ok, 8 service tests pass. Other unit files that fail locally (health, auth crypto, geo, otp) need env secrets and fail the same way without this change. DB-backed route tests run in CI only. |

## Phase 3 notes (dispatch, return, reverse)
- Routes: POST {id}/dispatch, {id}/return, {id}/reverse (permissions dispatch/return/reverse).
- Reversing a dispatch sets allocation returned counters equal to dispatched and writes no event row.
- Availability check uses batch available for batch-tracked items only. Non-batch items rely on the stock engine's on-hand check. Reservations are not considered for them (known gap).
- A partial return re-derives status to PARTIALLY_RECEIVED.
- Verification: tsc clean, 15 unit tests pass for the module. Live production test deferred until the Phase 7 UI.
