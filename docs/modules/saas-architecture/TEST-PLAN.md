# Test plan: SaaS Architecture

Standard: docs/TESTING-PLAN.md section 4. Tick when written and passing; record the command in PROGRESS.md verification log.

## Acceptance criteria to tests
| AC / rule | Layer | Test file > name | Status |
|---|---|---|---|
| AC1, R1 to R8 | Unit | `modules/entitlement/entitlement.resolver.spec.ts` > plan, add-ons, overrides, dependencies, unknown keys, snapshot always resolvable | [ ] |
| AC2, R9, R10 | Integration | generated across the registry > every switchable module's routes: off, locked, on | [ ] |
| AC3 | Unit | catalog spec > registry module without mapping fails | [ ] |
| AC4, R11, R12 | Integration | per limited resource > blocks create at limit, allows update, read, delete, concurrent creates | [ ] |
| AC5, R13, R14 | Integration | sidebar, role catalog, search > module off hides, data and grants kept, back on restores | [ ] |
| AC6, R20 | Integration | full existing suite with every org on `legacy` passes unchanged | [ ] |
| AC7, R16, R17 | Integration | subscription lifecycle with fake provider > upgrade, downgrade preview, period-end downgrade, cancel, failed payment to grace to restricted | [ ] |
| AC8, R18 | Integration | webhook replay, reorder, duplicate > no regression, no double apply | [ ] |
| AC9 | Integration | tenant isolation across entitlements, modules, subscription, invoices | [ ] |
| AC10, R22 | Integration | audit entry with before and after for every change | [ ] |
| AC11 | e2e and a11y | en and ar parity, no raw keys, RTL screenshots of modules page, plan page, pricing page | [ ] |
| AC12 | Staging e2e | provider test-mode checkout per launched adapter | [ ] |
| R2 to R4 | Unit | dependency enable and disable rules, `MODULE_DEPENDENCY_LOCKED`, `MODULE_REQUIRED_BY` | [ ] |
| R19, R21 | Unit | per-currency prices, trial eligibility | [ ] |

## Checklist
- [ ] Unit: each service rule and state transition (by SPEC rule id)
- [ ] Integration per endpoint: 401, 403 (non-owner), tenant isolation, 422, domain errors, happy path, audit entry
- [ ] Concurrency: simultaneous module switch and plan change, racing limit checks, duplicate webhooks
- [ ] Fake billing provider in test-support, plus provider contract tests shared by every adapter
- [ ] Test builders for plans, subscriptions, overrides added through real endpoints
- [ ] e2e main journey (pick modules, hit limit, upgrade) and permission-denied journey
- [ ] Locales en/ar parity, no raw keys
- [ ] a11y scan on modules page, plan page, pricing page
- [ ] Regression tests for bugs found during build
- [ ] codegen clean, typecheck, lint
