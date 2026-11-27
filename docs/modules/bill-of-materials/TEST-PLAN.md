# Test plan: Bill of Materials

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS.md.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| AC1, R1 to R7, R10 | Unit | `modules/bill-of-materials/bill-of-materials.service.spec.ts` > validation per rule | [ ] |
| AC2, R8 | Unit + integration | cycle spec > direct, two level, three level, non default BOM | [ ] |
| AC3, R9 | Integration | default switch, first BOM becomes default, partial unique index | [ ] |
| AC4, R2, R5 | Unit | service and route > service item, inactive item | [ ] |
| AC5 | Unit | estimate rounding, scrap, scale | [ ] |
| AC6 | Integration | availability with several lines, zero stock, decimals | [ ] |
| AC7 | Integration | delete blocked after an order references it | [ ] |
| AC8 | Integration | edit BOM after draft order, order unchanged | [ ] |
| AC9 | Integration | 401, 403, tenant isolation for every id in the body | [ ] |
| AC10 | Unit | locale parity | [ ] |

## Edge cases
Unit conversion changes after BOM creation (snapshot holds), scrap 0 and 100, 100 lines, duplicate component, code differing only by case, deactivating a component item, turning off `can_assembled` on an item with an active BOM.

## Checklist
- [ ] Unit per rule id
- [ ] Integration per endpoint (401, 403, tenant, 422, happy path, audit)
- [ ] Test builders for BOMs through real endpoints
- [ ] Web: form validation, estimate panel, cycle error message, empty states

## Gate
All rows ticked and repo quality gates green.
