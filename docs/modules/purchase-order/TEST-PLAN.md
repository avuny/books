# Test plan — Purchase Order & Supplier Shipment

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS verification log.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| Status derivation from shipped, received, cancelled qty | unit | `purchase-order.service.spec.ts` | passing |
| Draft create, number allocation, supplier must be an active VENDOR | unit | `purchase-order.service.spec.ts` | passing |
| Confirm, close, cancel, delete rules and on-order projection | unit | `purchase-order.service.spec.ts`, `inventory-projection` spec | passing |
| Shipment post and reverse, qty re-validation | unit | `purchase-shipment.service.spec.ts` | passing |
| Payment term seed, cap, name uniqueness, system read-only | unit | `payment-term.service.spec.ts` | passing |
| Error to HTTP status mapping, 422 validation | unit (mocked service) | `purchase-order.routes.test.ts` | passing |
| 401, tenancy, 404, 422, empty list, number preview | integration | `purchase-order.routes.int.test.ts` | written, not run |
| Payment term lifecycle over HTTP | integration | `payment-term.routes.int.test.ts` | written, not run |
| Draft to confirmed to shipped journey over HTTP | integration | n/a | open |
| 403 per permission, audit entries | integration | n/a | open |
| Money helpers (minor units) and payload builder | web unit | `build-payload.test.ts`, `money-input.test.ts`, `format-money.test.ts` | passing |
| Locale parity | web | `pnpm sync:i18n:check`, contracts `locales.test.ts` | passing |

## Checklist
- [x] Unit: each service rule and state transition (by SPEC rule id)
- [ ] Integration per endpoint: 401, 403, tenant isolation, 422, domain errors, happy path, audit entry
- [ ] Posting documents: idempotency, reversal, concurrency, reconciliation (stock, journal)
- [ ] Test builders added to test-support (through real endpoints)
- [ ] e2e main journey + permission-denied journey
- [x] Locales en/ar parity, no raw keys
- [ ] a11y scan on list and form
- [ ] Regression tests for bugs found during build
- [~] codegen clean, typecheck, lint (typecheck and web lint pass; server has no eslint config)
