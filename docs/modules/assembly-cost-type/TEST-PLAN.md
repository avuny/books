# Test plan: Assembly Cost Type

Standard: docs/TESTING-PLAN.md section 4.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| AC1, R1 to R4 | Unit + integration | `modules/assembly-cost-type/assembly-cost-type.service.spec.ts` > create, update, name unique case-insensitive, kind | [ ] |
| AC2 | Integration | delete blocked when a BOM line or order line uses it, deactivate, new line with inactive type rejected | [ ] |
| AC3, R5 | Integration | org init seeds rows, backfill idempotent, existing name skipped | [ ] |
| AC4 | Unit + integration | 401, 403, tenant isolation, locale parity | [ ] |

## Checklist
- [ ] Unit per rule
- [ ] Integration per endpoint
- [ ] Web: list, dialog, inline create, empty state, RTL

## Gate
All rows ticked and repo quality gates green.
