# Test plan: Assembly Order

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS.md verification log.

Testing note: the local test database runs a pass-through transaction with no rollback, while production uses a real transaction (verify `packages/db/src/client.ts`). Rollback behaviour cannot be proven by asserting on rows after a failure in these tests. Prove it by validating before writing (nothing to roll back) and by unit tests with an injected failing port that assert no later port is called. Do not trust the older note in `docs/TESTING.md`.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| AC1, R1 to R7, R30 | Unit | `modules/assembly-order/assembly-order.service.spec.ts` > draft create, update, delete, cancel, validation | [ ] |
| AC2, R8 to R10 | Unit | `assembly-order.scaling.spec.ts` > factor, scrap, rounding half up, cost line scaling | [ ] |
| AC3 | Integration | route test > ad hoc order post | [ ] |
| AC4, R16, R19 | Integration | post > layers consumed, output layer value equals materials plus additional | [ ] |
| AC5, R11 | Integration | insufficient stock per location, per batch, with `allowNegativeStock` | [ ] |
| AC6, R17 | Integration | stock from an adjustment gain (no layer) blocks | [ ] |
| AC7, R12 to R15 | Integration | FEFO pick, output batch, expiry cap, later expiry rejected | [ ] |
| AC8, R25 | Integration + unit | journal balanced; none when additional cost is 0; failing journal port stops the post | [ ] |
| AC9, R23 | Integration | repeated and concurrent post | [ ] |
| AC10 | Integration | two orders race for one component | [ ] |
| AC11, R29 | Integration | reverse restores stock, batches, layers, journal | [ ] |
| AC12, R28 | Integration | reverse blocked after partial sale or transfer of output | [ ] |
| AC13 | Integration | cross-tenant read and use of every referenced id | [ ] |
| AC14 | Unit + integration | permission matrix, denied calls touch nothing | [ ] |
| AC15 | Reconciliation | invariants I1 to I6 after each scenario | [ ] |
| AC16 | Unit | locales en and ar parity, error code keys | [ ] |
| AC17 | Integration | trace both directions | [ ] |

## Edge cases to cover
- Rounding: quantity with 6 decimals, scale factor with a repeating decimal, bigint cost split over many layers, remainder stays exact.
- Component in several batches and several layers in one line.
- Same item in two locations of the warehouse.
- Output item equals a component (rejected). Output with no shelf life but expiry tracked.
- Currency other than the organization currency in a layer.
- Order number race (two creates at once), `NUMBER_TAKEN`.
- Max components (100) and max movement lines.
- Closed accounting period, future date.
- Item flag change (`can_assembled` off) while referenced.
- Reverse twice, reverse a draft, cancel a posted order.

## Checklist
- [ ] Unit: each rule R1 to R35 by id (R35: service rejects any mode other than SINGLE_STEP, posting_seq is 1)
- [ ] Integration per endpoint: 401, 403, tenant isolation, 422, domain errors, happy path, audit entry
- [ ] Posting: idempotency, reversal, concurrency, reconciliation (stock, layers, journal)
- [ ] Test builders in test-support (through real endpoints): items, locations, stock in, BOM, cost type
- [ ] Web: form validation, short stock display, post and reverse dialogs, permission-denied view
- [ ] e2e: main journey (receive stock, create BOM, create order, post, see stock and cost) and one denied journey

## Gate
All rows ticked, invariants green, the repo quality gates (see docs/TESTING-PLAN.md) green, post-deploy smoke recorded in PROGRESS.
