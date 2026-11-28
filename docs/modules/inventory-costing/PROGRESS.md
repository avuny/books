# PROGRESS: Inventory Costing (Weighted Average Cost and cost integrity)

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Analysis | [`ANALYSIS.md`](./ANALYSIS.md) |
| Last updated | 2026-11-27 |
| Current phase | Phase 1 |
| Tasks done | 4 / 22 |
| Gates passed | 0 / 9 |

## How to use this file
Resume protocol: 1) read AGENTS.md files, ANALYSIS.md and SPEC sections 0 to 4 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts, status board and Next action with every change. Log decisions and deviations; never silently edit SPEC.
Each phase ships as its own PR. Manufacturing (assembly) waits for gate 6.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action
> **P1-04**: run the migration `0035_inventory_costing_foundation` on a real Postgres (CI integration job) and confirm gate 1. Re-check the journal against origin/dev before every push.

## Status board
| Phase | Title | Tasks | Gate | Status |
|---|---|---|---|---|
| 0 | Decisions and repository checks | 2 | gate 0 | [ ] |
| 1 | Pure math, contracts, schema and migration | 4 | gate 1 | [ ] |
| 2 | Valuation engine, FIFO strategy, cost input enforced | 4 | gate 2 | [ ] |
| 3 | WAC strategy | 4 | gate 3 | [ ] |
| 4 | Adjustments | 2 | gate 4 | [ ] |
| 5 | Conversion and backfill | 2 | gate 5 | [ ] |
| 6 | Reports and reconciliation | 2 | gate 6 | [ ] |
| 7 | Web UI | 1 | gate 7 | [ ] |
| 8 | Hardening and docs | 1 | gate 8 | [ ] |

## Tasks
| ID | Task | Done when | Status |
|---|---|---|---|
| P0-01 | Close open decisions | Decision log filled | [x] |
| P0-02 | Run SPEC section 14.2 checks | Results in the verification log | [x] |
| P1-01 | Pure arithmetic and rules in contracts (issue value, receipt value, millions helpers, cost input schemas) | Property tests for AC5 | [x] |
| P1-02 | Error codes and locales en and ar | Locale parity test | [x] |
| P1-03 | Schema: pools, entries, layer, allocation and adjustment line columns | Section 5 matches code | [x] |
| P1-04 | Migration with backfill flags, tested on a copy of data | AC17 | [~] |
| P2-01 | Valuation engine port and FIFO strategy | Existing FIFO tests pass unchanged | [~] 2a done: engine and FIFO strategy behind the costing service, no caller uses it yet. 2b to 2d move callers over. Sales delivery keeps its own FIFO adapter until a later phase. |
| P2-02 | Stock movement post and reverse call the engine, cost input required for value-in | AC1 | [~] 2b: post costs value-in lines that carry a cost, through a costing port. Requirement (reject lines without cost) is switched on in 2c, once callers stop writing their own layers, so nothing double-counts. Reverse inherits cost in 2c. |
| P2-03 | Opening stock and purchase receipt pass cost inputs, opening cost required | AC1, AC2 | [~] 2c part 1: purchase receipt passes the document value as cost (layer now written by the stock movement, currency and receipt date carried); opening stock requires a cost per line (explicit 0 is stored as zero-cost, reason OTHER, to confirm). 2c part 2: adjustment gain lines carry unitCost (and a reason for zero), confirm fails with INVENTORY_ADJUSTMENT_COST_REQUIRED without it, and the layer is now written (it was missing, ANALYSIS F3). Adjustment form: gain lines show a unit cost pre-filled with a proposal (last receipt layer, here first, then any location); kept as is it is stored as CONFIRMED_PROPOSAL, any other typed cost as USER; no proposal means a typed cost or a free reason. Still to do: require cost on all value-in lines, sale return and reversal inheriting cost, missing inventory row error. |
| P2-04 | Transfer uses the engine, uncovered quantity fails | AC6, AC7 | [~] 2d: internal moves (transfer, transit, return) move FIFO layers with the stock through the engine: source layers are consumed, inherited layers are written at the destination keeping date and origin. A forward move of uncosted stock fails with COST_UNDETERMINED (R6, R34). A reversal moves what is covered and never fails on old uncosted stock. No migration, the derived-source unique index already allows one layer per consumed layer. |
| P3-01 | WAC receipt and issue with locks and seq | AC4, AC5 | [~] 3a: `wac-strategy.ts` (pool row lock first, append only entries with seq, exact integer math, last unit takes the remainder), engine dispatch by item method, stock movement costs WAC value-in, value-out and reversals through the port. Unit tests cover worked examples 1 to 6 and a random no drift run. Not yet run on a real database. |
| P3-02 | WAC reversals and sale return inheritance | AC8, AC9 | [~] 3a: reversal rules R27, R28, R30 and inheritance R31 are in the strategy and tested. The sales return caller does not use it yet (it moves with sales delivery). |
| P3-03 | Negative stock block, currency, zero cost rules | AC2, AC6 | [~] 3a: a WAC issue above the pool fails with COST_NEGATIVE_STOCK_NOT_SUPPORTED even when the item allows negative stock. Other currency fails. Zero cost needs a reason. A WAC value-in line without cost fails. |
| P3-04 | Concurrency and idempotency tests on a real database | AC11 | [ ] |
| P4-01 | Adjustment lines with cost, gain requires cost, loss uses engine | AC12 | [ ] |
| P4-02 | Adjustment journal with real amount, failure aborts | AC12 | [ ] |
| P5-01 | Conversion operation with drift check | AC13 | [ ] |
| P5-02 | Readiness report for weighted average items with stock | AC17 | [ ] |
| P6-01 | Valuation report and cost ledger endpoints | AC15 | [ ] |
| P6-02 | Reconciliation endpoint and scheduled check | AC15 | [ ] |
| P7-01 | Web: item, opening stock, adjustment forms, ledger, reports | e2e journeys | [ ] |
| P8-01 | REGISTRY, FEATURE-TRACKING, TESTING docs, post-deploy smoke | Docs updated | [ ] |

## Decision log
| ID | Decision (default applied) | Status | Owner response · date |
|---|---|---|---|
| W1 | One pool per item per organization | decided | owner, 2026-11-27 (WhatsApp), as the default |
| W2 | One average per item, not per batch | decided | owner, 2026-11-27 (WhatsApp), as the default |
| W3 | No negative stock for costed items in v1. Before enforcing, run a prod data check for items below zero and report counts to the owner | decided | owner, 2026-11-27 (WhatsApp), as the default |
| W4 | Posting order costing, flag backdated | open | no response yet |
| W5 | Invoice price differences to PPV | decided | owner, 2026-11-27 (WhatsApp), as the default |
| W6 | One Inventory account for the WAC work, per category accounts as a separate module | decided | owner, 2026-11-27 (WhatsApp), as the default |
| W7 | Legacy zero layers flagged for review only | open | no response yet |
| W8 | Convert weighted average items with the drift check | open | no response yet |
| W9 | Gain adjustment proposal is the pool average | open | no response yet |

Owner decisions already given (2026-11-27, WhatsApp): block stock-in with no valid cost across the whole inventory system; never fall back to the item default cost; distinguish missing from zero; enforce in the backend; implement Weighted Average Costing before manufacturing and do not use FIFO as a fallback for weighted average items; manufacturing reuses the central costing engine.

## Deviations
- D1 (phase 1): `unitCost` in the cost input is a decimal string in **minor units per base unit** (up to 10 decimals), not major units. The saved value is the integer total (SPEC R18). The web form converts from major units using the currency exponent. Reason: keeps all costing code in integer minor units and avoids a currency-exponent lookup in the engine.
- D2 (phase 1): adjustment lines get `cost_value_minor` (bigint, the source of truth) next to the display `unit_cost`. SPEC 5.2 listed only `unit_cost`. Reason: owner rule, money is bigint minor units and the unit cost is only a display value.
- D3 (phase 1): `inventory_cost_allocations.outgoing_movement_line_id` becomes nullable, with `conversion_entry_id`, so a CONVERSION allocation (SPEC R36) is tied to a conversion entry instead of a movement line. A check keeps the two shapes exclusive (ISSUE needs a line, CONVERSION needs an entry).
- D4 (phase 1): `inheritedShareMinor` uses a cumulative round-half-up target minus the value already inherited. The last part lands exactly on the source total and no part can be negative. Same result as "last takes the remainder".

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
| 2026-11-27 | P0-02 | read-only SELECTs on production (6 orgs, 15 items) | 0 items below zero, 0 weighted average items, 0 zero value layers, account 5600 unused in all orgs. 3 FIFO items in one org have stock that does not match layers (156 vs 11, 14 vs 40, 40 vs 0). |
| 2026-11-27 | P1-01, P1-02 | `pnpm --filter @avuny/contracts exec vitest run` | 318 tests pass, including 12 new (300 seeded random sequences, no drift) and en/ar parity |
| 2026-11-27 | P1-03 | `pnpm --filter @avuny/db typecheck` | clean |
| 2026-11-27 | P1-04 | `drizzle-kit generate` | `0035_inventory_costing_foundation` generated after `0034_sales_credit_note` (renumbered twice, from 0032 then 0034, as dev took numbers and later renumbered its own sales migrations). Not yet run on a real database (none in this sandbox). |

### Phase 3a (WAC strategy), 2026-11-28

- Owner decisions applied: one pool per item for the whole organization, one average per item, negative stock blocked, price differences to the variance account (price variance is not built in 3a, it belongs to the supplier invoice work), single inventory account kept.
- Found and fixed while wiring: a standalone stock movement `post` or `reverse` committed the header and lines when costing failed after they were written, so a failed posting could leave a movement row without balances and block the source. The posting now rolls back on any failure. Callers that pass their own transaction already had to roll back, as before.
- Open risk, not changed: sales delivery, adjustment loss and purchase return still cost value-out from FIFO layers themselves. A WAC item would be costed from the pool by the stock movement but read zero from layers by those callers. Until they take the engine value, an item should not be set to WAC in production. Production has no WAC items today.
