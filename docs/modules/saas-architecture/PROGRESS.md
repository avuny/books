# PROGRESS: SaaS Architecture

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Last updated | 2026-11-27 |
| Current phase | S0 |
| Tasks done | 0 / 33 |
| Gates passed | 0 / 9 |

## How to use this file
Resume protocol: 1) read AGENTS.md files and SPEC sections 0 to 4 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts, status board and Next action with every change. Log decisions and deviations; never silently edit SPEC.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action
> **S0-01**: get the owner's answers on the open decisions below. Blocking ones: Q1, Q2, Q4, Q5, Q10. The rest have defaults that may be used if the owner says "use defaults". Also record fixes-plan decisions D1 to D8 (`../SAAS-SPEC-FIXES-PLAN.md`), which are still open.

## Status board
| Phase | Title | Tasks | Gate | Status |
|---|---|---|---|---|
| S0 | Decisions and spikes | 4 | gate S0 | [ ] |
| S1 | Module catalog in code | 3 | gate S1 | [ ] |
| S2 | Entitlement core | 5 | gate S2 | [ ] |
| S3 | Enforcement | 5 | gate S3 | [ ] |
| S4 | Module management UI and gating UI | 4 | gate S4 | [ ] |
| S5 | Subscriptions and lifecycle | 4 | gate S5 | [ ] |
| S6 | Payments | 4 | gate S6 | [ ] |
| S7 | Billing UI, pricing page, jobs | 3 | gate S7 | [ ] |
| S8 | Hardening and launch | 1 | gate S8 | [ ] |

## Open decisions for the owner
Each has a proposed default. "Blocks" says which phase cannot start without the answer. Answer with the number and a letter, or "defaults".

| # | Decision | Options | Proposed default | Blocks |
|---|---|---|---|---|
| Q1 | Plan ladder and names | (a) Free, Pro, Max, plus Enterprise by contact (admin-granted); (b) Free, Starter, Pro, Business, Enterprise as in the existing plan spec; (c) your own list | (a). It matches what you described (free, pro, max). The existing spec's Starter and Business tiers can be added later as plans, it is only data. | S2 seed, S7 |
| Q2 | How modules are sold | (a) Plans are bundles of modules and limits, plus add-ons for extra modules and limits; (b) pure a la carte, each module priced alone, no tiers; (c) tiers only, no add-ons in v1 | (a). Simple to explain, fits the free/pro/max idea, and add-ons cover "I only need one extra module". Start with (c) at launch if you want fewer moving parts; the model supports both. | S2, S6 |
| Q3 | Which module goes in which plan | Draft matrix in the next section | Use the draft; adjust numbers any time before S2 seed. Only enforceable features are seeded. | S2 seed |
| Q4 | Shape of the Free plan | (a) Free forever with small limits; (b) 14-day trial of Pro, then Free; (c) trial only, no free tier | (b). Everyone sees the full product first, then lands on a limited free plan, nobody loses data. | S5 |
| Q5 | Payment provider(s) at launch | (a) Stripe only, USD cards; (b) Stripe plus one Egyptian processor (EGP, local cards, wallets); (c) manual bank transfer only at first | (b) as the target, built in the order Stripe, then local processor, with manual transfer as a fallback adapter. Check before committing: whether Stripe can bill from your business country, Egypt card acceptance and VAT. S0-03 is a spike that answers this with sources, and you pick the processor after it. | S6 |
| Q6 | What happens when a module is switched off or no longer in the plan | (a) Data kept and readable, no new documents, open documents can be completed or cancelled (wind down); (b) fully read-only at once; (c) hidden completely | (a). It is the safest for accounting and stock data, and it is reversible. | S3 |
| Q7 | Which modules are on for a new organization | (a) Ask during onboarding, defaults by business type (trading, warehouse, accounting only); (b) everything on, owner turns off; (c) minimal core, owner turns on | (a), with Inventory on by default. | S4 |
| Q8 | Enterprise | (a) Not self-serve in v1; an admin grants a plan and overrides by hand after a sales conversation; (b) build self-serve custom pricing | (a) (same as fixes plan D7). | S5 |
| Q9 | Show locked modules in the sidebar with an upgrade prompt | (a) Yes, per module configurable; (b) never, hide them | (a), on for the main modules, because it is how customers discover paid modules. | S4 |
| Q10 | Existing organizations at launch | (a) Keep them on a hidden Legacy all-access plan until you decide a date, then move them with notice; (b) move everyone to Free or a trial on launch day; (c) grandfather them on Pro forever | (a). Nothing changes for current users, and you choose the migration date and terms later. All current data so far is test data you control, so (b) is safe too if you prefer a clean start. | S2 |
| Q11 | Trial rules | One trial per organization; question is whether one person creating a second organization gets another trial | One trial per organization, but a second trial for the same owner account is not allowed (tracked on the user). Stops trial farming. | S5 |
| Q12 | Invoice numbering | (a) Provider-generated numbers; (b) our own per-organization sequence | (b) if the local processor is used (Egyptian tax invoices may need our own sequence, verify in S0-03), otherwise (a). | S6 |
| Q13 | Cap on organizations one user may own | Highest cap among the user's organizations, Free default when none | As proposed in SPEC 2.5. | S3 |
| Q14 | Backfill accounting when Accounting is turned on after Purchasing already ran | (a) Offer a one-time backfill; (b) never, start from the date it is enabled | (b) for v1. Backfill is a separate feature with its own risk. | S3 |

### Draft plan matrix (for Q3)
Numbers reuse the existing plan spec where it had them, shifted onto Free, Pro, Max. Modules marked "future" are not seeded until they exist.

| Entitlement | Free | Pro | Max | Enterprise |
|---|---|---|---|---|
| Core, Inventory | yes | yes | yes | yes |
| Purchasing | no (locked) | yes | yes | yes |
| Sales | no | yes (when built) | yes | yes |
| Accounting level | none | basic | full | full |
| Inventory advanced (batches, transfers, reservations) | no | yes | yes | yes |
| Inventory costing (WAC, FIFO choice) | no | no | yes | yes |
| Assembly | future | future | yes | yes |
| Managed members | 2 | 10 | 50 | custom |
| Items | 50 | 5,000 | 50,000 | custom |
| Warehouses | 1 | 5 | 25 | custom |
| Custom roles | no | yes | yes | yes |
| Extra units per collection | no | yes | yes | yes |
| Activity log visibility window | 7 days | 90 days | 1 year | unlimited |
| Organizations a user may own | 1 | 3 | 10 | custom |
| API access | no | no | yes | yes |

Prices are not proposed here. They need market and cost input from the owner (Q5 decides currencies). The structure allows one price per currency and interval.

## Tasks
Every task: "done when" is checkable. Every phase ends with a gate. Run `pnpm typecheck` and the relevant tests after each phase (AGENTS.md).

### Phase S0: Decisions and spikes
- [ ] **S0-01** Owner answers Q1 to Q14 and fixes-plan D1 to D8. Done when: answers recorded in the Decisions log below.
- [ ] **S0-02** Repository checks from SPEC section 13, output pasted in the Verification log. Done when: all 7 checks have a recorded result.
- [ ] **S0-03** Provider spike: for each candidate in Q5, verify with current official sources: can the business onboard from Egypt, supported currencies and payment methods, subscription support, webhook model, Workers compatibility, fees, tax invoice requirements. Done when: a one-page comparison with source links is added to this folder as `PROVIDER-SPIKE.md`.
- [ ] **S0-04** Transaction-capable database driver decided and merged (fixes plan Phase 2) or scheduled before S5. Done when: a rollback test passes.
- **Gate S0**: S0-01 to S0-04 ticked; no open "blocks S1" decision.

### Phase S1: Module catalog in code
- [ ] **S1-01** Add product metadata to the registry (`product`, `dependsOn`, `switchable`, `defaultOn`, `showLocked`) and a derived `MODULE_CATALOG` in `packages/contracts`. Done when: the catalog type-checks and lists every registry module under exactly one product module.
- [ ] **S1-02** Dependency graph from the real import scan (S0-02) with a test that the graph is acyclic and that every dependency is a real product module. Done when: test passes.
- [ ] **S1-03** CI guard: a registry module without catalog mapping fails (AC3). Done when: removing a mapping makes CI fail locally.
- **Gate S1**: no behavior change anywhere; full test suite green.

### Phase S2: Entitlement core
- [ ] **S2-01** Contracts: plan, entitlement, snapshot, module-state schemas, error codes (contracts first, `z` from `@avuny/zod`). Done when: contracts build and export.
- [ ] **S2-02** DB schema and one migration: plans, plan_prices, plan_entitlements, addons, subscriptions tables (from the existing specs), organization_modules, overrides, organization_entitlements, `organizations.trial_used_at`, `limits_grace_until`. Money in minor units. Done when: migration applies on a clean database and on a copy of production data.
- [ ] **S2-03** Resolver as a pure function with unit tests for R1 to R8 (AC1). Done when: tests pass.
- [ ] **S2-04** Seed: catalog-validated plans per Q1 to Q3, plus `legacy` plan; assign `legacy` to every existing organization, and Free or Legacy by Q10 to new ones. Done when: seed is idempotent, unknown keys rejected (R6), AC6 suite passes.
- [ ] **S2-05** Entitlement service and snapshot recompute inside transactions (R5), version bump, audit events (R22). Done when: unit and integration tests pass.
- **Gate S2**: deployed to production with every organization on `legacy`; production smoke test shows no behavior change.

### Phase S3: Enforcement
- [ ] **S3-01** `requireModule(key)` middleware and generated route mapping (R9, AC2). Done when: the generated test passes for every switchable module.
- [ ] **S3-02** Replace every `Dummy*` port (`PlanFeatures`, `UnitCollectionPlanFeatures`, `OrganizationLimits`) with the entitlement service. Done when: no `Dummy*` is wired in `deps.ts`.
- [ ] **S3-03** Limit checks with scope in item, warehouse, location, party, member, role, unit collection, organization services (R11, R12, AC4). Counters use the real active-flag columns. Done when: each limit has an integration test.
- [ ] **S3-04** Sidebar and role permission catalog filtered by module state; role grants kept inert (R13, R14, AC5). Done when: tests pass.
- [ ] **S3-05** Remove the in-memory organization cache wiring (fixes plan 4.2 and 5.2). Done when: grep finds no DummyCache wiring.
- **Gate S3**: with a test organization on a restricted plan, every module and limit behaves per spec; legacy organizations unaffected.

### Phase S4: Module management UI and gating UI
- [ ] **S4-01** `useEntitlement`, `<Gate>`, upgrade prompt, limit banner components. Done when: Storybook or e2e shows each.
- [ ] **S4-02** Settings, Modules page with switches, dependency hints, wind-down copy (Q6). Done when: e2e switches a module off and on.
- [ ] **S4-03** Onboarding modules step (Q7). Done when: new org flow shows it and respects the choice.
- [ ] **S4-04** Locked sidebar entries per Q9; en and ar strings; RTL screenshots (AC11).
- **Gate S4**: owner can run the full journey on a staging organization: pick modules, hit a limit, see upgrade prompt.

### Phase S5: Subscriptions and lifecycle
- [ ] **S5-01** Subscription state machine, access states (SPEC 3.2), grace and restricted behavior. Done when: AC7 passes with a fake provider.
- [ ] **S5-02** Trials and trial eligibility (R21, Q11), downgrade preview and period-end downgrade (R17).
- [ ] **S5-03** Admin back office: assign plan, grant override with reason and expiry (Q8), audit.
- [ ] **S5-04** Scheduled jobs on Workers cron triggers: trial ending, grace expiry, entitlement drift check.
- **Gate S5**: plans can be assigned by hand and the full lifecycle runs with a fake provider. Requires S0-04.

### Phase S6: Payments
- [ ] **S6-01** `BillingProvider` port, event ledger, ordering guard (R18, AC8).
- [ ] **S6-02** First adapter per Q5 (default Stripe, fetch HTTP client, raw-body webhook route, test mode). Done when: AC12 passes in staging.
- [ ] **S6-03** Invoices, credits, proration, numbering per Q12.
- [ ] **S6-04** Second adapter (local processor) and manual bank transfer adapter, if chosen in Q5.
- **Gate S6**: a real test-mode payment moves a staging organization from Free to Pro and back, with correct invoice and audit.

### Phase S7: Billing UI, pricing page, jobs
- [ ] **S7-01** Plan and billing page, payment methods, invoices, cancel and resume.
- [ ] **S7-02** Public pricing page and plan comparison from `GET /plans`.
- [ ] **S7-03** Dunning emails, trial and grace banners, receipts, locale parity.
- **Gate S7**: owner signs off the screens on staging.

### Phase S8: Hardening and launch
- [ ] **S8-01** Tenant isolation tests (AC9), load check on the resolver, failure drills for webhooks, reconciliation job, runbook, tax and legal pages checked, Legacy migration executed per Q10, production launch with a staged rollout.
- **Gate S8**: launch checklist signed by the owner.

## Risks
| Risk | Mitigation |
|---|---|
| Gating touches many modules and one is missed | Route mapping generated from the registry plus the CI guard (R9, AC2, AC3) |
| Breaking current customers | Legacy plan, snapshot built before enforcement, S2 gate is a no-op in production |
| Payment edge cases (retries, out-of-order events) | Event ledger and ordering guard, reconciliation job, fake provider tests |
| Provider not available for Egypt | S0-03 spike before any payment code; manual transfer adapter as fallback |
| Over-engineering before revenue | Phases S1 to S5 are useful without a provider; Q2 option (c) and Q5 option (c) are valid minimal launches |
| Real transactions missing in the db driver | S0-04 and fixes plan Phase 2 gate S5 |

## Decisions log
(empty; record owner answers here with date and wording)

## Deviations
## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
