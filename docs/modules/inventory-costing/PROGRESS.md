# PROGRESS: Inventory Costing (Weighted Average Cost and cost integrity)

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Analysis | [`ANALYSIS.md`](./ANALYSIS.md) |
| Last updated | 2026-11-27 |
| Current phase | Phase 1 |
| Tasks done | 0 / 22 |
| Gates passed | 0 / 9 |

## How to use this file
Resume protocol: 1) read AGENTS.md files, ANALYSIS.md and SPEC sections 0 to 4 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts, status board and Next action with every change. Log decisions and deviations; never silently edit SPEC.
Each phase ships as its own PR. Manufacturing (assembly) waits for gate 6.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action
> **P1-01**: W1, W2, W3, W5, W6 are decided. Start phase 1 (pure math, contracts, schema). Prod data check for items below zero is needed before negative stock is enforced (phase 2/3), owner to supply counts.

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
| P0-02 | Run SPEC section 14.2 checks | Results in the verification log | [ ] |
| P1-01 | Pure arithmetic and rules in contracts (issue value, receipt value, millions helpers, cost input schemas) | Property tests for AC5 | [ ] |
| P1-02 | Error codes and locales en and ar | Locale parity test | [ ] |
| P1-03 | Schema: pools, entries, layer, allocation and adjustment line columns | Section 5 matches code | [ ] |
| P1-04 | Migration with backfill flags, tested on a copy of data | AC17 | [ ] |
| P2-01 | Valuation engine port and FIFO strategy | Existing FIFO tests pass unchanged | [ ] |
| P2-02 | Stock movement post and reverse call the engine, cost input required for value-in | AC1 | [ ] |
| P2-03 | Opening stock and purchase receipt pass cost inputs, opening cost required | AC1, AC2 | [ ] |
| P2-04 | Transfer uses the engine, uncovered quantity fails | AC6, AC7 | [ ] |
| P3-01 | WAC receipt and issue with locks and seq | AC4, AC5 | [ ] |
| P3-02 | WAC reversals and sale return inheritance | AC8, AC9 | [ ] |
| P3-03 | Negative stock block, currency, zero cost rules | AC2, AC6 | [ ] |
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
None yet.

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
