# Test plan: Inventory Transfer

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS.md verification log.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| AC1, R1 to R8 | Unit | `modules/inventory-transfer/inventory-transfer.service.spec.ts` > draft create, update, delete, cancel | [ ] |
| AC2, AC3 | Unit + integration | service spec and route test > dispatch, insufficient stock | [ ] |
| AC4, AC5 | Unit + integration | service spec > receive full, partial, exceeds pending | [ ] |
| AC6 | Unit | service spec > return rest, short-close | [ ] |
| AC7 | Integration | batch preservation through dispatch and receive | [ ] |
| AC8 | Integration | repeated dispatch and reversal rejected, one movement per source | [ ] |
| AC9 | Integration | concurrency: opposite transfers, racing receipts | [ ] |
| AC10 | Integration | injected failure after movement rolls everything back | [ ] |
| AC11 | Unit | permission denied touches no repo or audit | [ ] |
| AC12 | Unit + reconciliation | costing value conservation | [ ] |
| AC13 | Integration | shortage journal balanced, no other journals | [ ] |
| AC14 | Unit | locales en/ar parity | [ ] |

## Checklist
- [ ] Unit: each service rule and state transition (by SPEC rule id)
- [ ] Integration per endpoint: 401, 403, tenant isolation, 422, domain errors, happy path, audit entry
- [ ] Posting documents: idempotency, reversal, concurrency, reconciliation (stock, journal)
- [ ] Test builders added to test-support (through real endpoints)
- [ ] e2e main journey + permission-denied journey
- [ ] Locales en/ar parity, no raw keys
- [ ] a11y scan on list and form
- [ ] Regression tests for bugs found during build
- [ ] codegen clean, typecheck, lint

## Test strategy (cases by area)
Use the existing patterns: service specs with `testing.ts` fakes (`inventory-adjustment.service.spec.ts`), DB-backed tests where the repo has them (`test-support/database.ts`), and a live check on a non-production org after deploy.

| Area | Cases |
| --- | --- |
| Normal flow | create, update, dispatch, receive all, status `RECEIVED`; quantities `S` down, `D` up, transit back to 0. |
| Insufficient stock | dispatch more than available fails with nothing written; available excludes reserved. |
| Batches | auto FEFO and FIFO allocation split across batches, explicit batches, blocked or recalled batch rejected, same batch ids at destination, line order preserved. |
| Partial receiving | two partial receipts, `EXCEEDS_PENDING`, return rest, close short, receive after return fails. |
| Duplicates | repeated dispatch, repeated draft lines, reused source id returns `STOCK_MOVEMENT_SOURCE_ALREADY_POSTED`. |
| Concurrency | two dispatches of the same transfer (one wins), A to B and B to A at once (no deadlock), two receipts racing on the same allocation, dispatch racing a stock adjustment on the same bin. |
| Rollback | failure injected after the movement (costing or journal): movement, allocations, layers and status are all rolled back (AGENTS §5.2: throw, do not return `{ ok: false }`). |
| Reversals | reverse dispatch before receipt, reverse a receipt when the destination stock was already used, reversal of a reversal rejected. |
| Costing | value conserved, rounding with odd quantities, partial layer take, uncovered stock, FIFO age preserved on derived layers, receive takes only its own transit layers when two transfers share the transit location. |
| Permissions | each action denied without its permission; denied calls touch no repo or audit. |
| Reconciliation | counters equal the sum of the transfer's movement lines; `inventory_items`/`inventory_item_batches` totals equal ledger sums; layers' remaining qty equals the stock they cover. |
| Frontend | form validation, status-dependent actions, receive dialog defaults, error mapping. |

CI is stricter than local checks: run `pnpm run typecheck` in each package before pushing.

