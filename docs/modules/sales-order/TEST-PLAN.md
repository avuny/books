# Test plan — Sales Order & Reservation

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS verification log.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|

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
