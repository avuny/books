# Test plan: Inventory Costing (Weighted Average Cost and cost integrity)

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS.md.

## Test environment notes (read first)

- Production uses a real database transaction. The local proxy used by the current tests passes statements through with no rollback (ANALYSIS section 9; `docs/TESTING.md` is out of date on this). Row assertions after a failure prove nothing about rollback. So:
  - validate before the first write wherever possible and assert that no write happened by injecting a failing port and checking later ports were never called;
  - concurrency and row lock tests (AC11) need a real Postgres with real transactions. Phase 0 decides how (a CI service container is the likely way). Until that exists AC11 is not covered and stays unticked.
- Pure math lives in `packages/contracts` with no database. Most correctness is proven there.
- Test builders create data through the real endpoints and services (items, locations, receipts, adjustments), not by direct inserts.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| AC1, R1 to R4, R9 | Unit + integration | `stock-movement.cost-integrity.spec.ts` > every value-in workflow without cost fails, no write | [ ] |
| AC2, R3 | Unit | cost input schema > zero needs reason, missing never zero | [ ] |
| AC3, R5, I8 | Static + unit | grep test: no `cost_price` in costing code. Proposal needs confirm source | [ ] |
| AC4, R10 to R12 | Unit | `wac.math.test.ts` > worked examples 1 to 3 of the SPEC | [ ] |
| AC5, R17 | Property | random receipt and issue sequences: received = issued + remaining, value never negative, empty pool has value 0 | [ ] |
| AC6, R6, R19 | Unit + integration | issue above pool fails, FIFO uncovered fails, transfer of uncosted stock fails | [ ] |
| AC7, R33 | Integration | transfer through transit leaves pool unchanged, FIFO derive layers still correct | [ ] |
| AC8, R26 to R30 | Integration | reverse allowed (example 3), blocked (example 4), twice rejected | [ ] |
| AC9, R31 | Integration | sale return inherits, partial returns sum to original, over return rejected | [ ] |
| AC10, R21 to R25 | Integration | backdated receipt and issue, flag set, closed period blocks, strict switch | [ ] |
| AC11, R41 to R43 | Integration (real Postgres) | parallel issues and receipts on one item, opposite orders, no drift, no deadlock | [ ] |
| AC12, R38, R39 | Integration | loss journal equals issue value, failing journal port aborts | [ ] |
| AC13, R35, R36 | Integration | conversion success, drift failure with report, GL unchanged | [ ] |
| AC14 | Regression | all current FIFO specs in `inventory-costing`, purchase-receipt, inventory-transfer, item opening stock | [ ] |
| AC15, section 10 | Reconciliation | I1 to I8 after each scenario above | [ ] |
| AC16 | Unit + integration | 401, 403, tenant isolation on every new endpoint, locale parity | [ ] |
| AC17 | Migration | backfill flags zero value layers, no value changes, idempotent rerun | [ ] |

## Scenario matrix (each runs for FIFO and WAC items unless noted)

| Scenario | Checks |
|---|---|
| Opening stock with cost, with no cost, with stated zero | accepted, rejected, accepted and flagged |
| Receipt then partial receipt then reversal | cost entries, journal, reversal rules |
| Receipt with fractional quantity (6 decimals) | exact value, no drift |
| Many small issues of one pool | remainder rule at the last unit |
| Sale then sale return, then second return | inheritance and remainder |
| Gain adjustment with typed cost, with proposal, with no cost | accepted, accepted with source, rejected |
| Loss adjustment | engine value, real journal, layers or pool reduced (fixes F3) |
| Transfer, transit, return of transit, receive | no value change (WAC), derive (FIFO) |
| Backdated receipt after later issues | posting order, flagged |
| Batch tracked item, issue from two batches | one pool average (WAC), per batch layers (FIFO) |
| Item with allow negative stock, issue above stock | rejected for costed items |
| Two users post at once | serialization, no drift |
| Conversion FIFO to WAC with and without drift | success and report |
| Currency mismatch | rejected |
| Assembly consume and produce (after phase 6) | uses engine values, produce inherits total |

## Checklist
- [ ] Unit: every rule R1 to R44 by id
- [ ] Integration per endpoint: 401, 403, tenant isolation, 422, domain errors, happy path, audit entry
- [ ] Reconciliation tests run after every scenario
- [ ] Migration tested on a copy of production-shaped data
- [ ] Web: cost required UI, zero cost reason, proposal confirm, error copy, RTL
- [ ] e2e: opening stock with cost, receipt, sale cost shown in the ledger, gain adjustment with cost, plus one denied journey

## Gate
All rows ticked, reconciliation green, repo quality gates green, post-deploy smoke recorded. Manufacturing does not start before gate 6.
