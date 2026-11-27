# PROGRESS: SaaS Architecture

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Last updated | 2026-11-27 |
| Current phase | A1 (admin track, running ahead of S0 spikes) |
| Tasks done | 2 / 75 |
| Gates passed | 0 / 22 |

## How to use this file
Resume protocol: 1) read AGENTS.md files and SPEC sections 0 to 4 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts, status board and Next action with every change. Log decisions and deviations; never silently edit SPEC.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action
> **A1-04**: login, TOTP enrollment, lockout, sessions, logout, invite acceptance; no register route (PAC1, PAC2). A1-02 and A1-03 are done (identity schema; registry, roles seed, bootstrap CLI). In parallel: S0-02 repo checks, S0-03 provider spike, and the open fixes-plan decisions D1 to D8.

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
| A1 | Platform apps, admin identity, roles | 6 | gate A1 | [~] |
| A2 | Plan and catalog configurator | 5 | gate A2 | [ ] |
| A3 | Sidebar, permissions, catalog viewer and overrides | 3 | gate A3 | [ ] |
| A4 | Organizations, users, subscriptions | 4 | gate A4 | [ ] |
| A5 | Payments and provider events | 3 | gate A5 | [ ] |
| A6 | Jobs and reminders | 4 | gate A6 | [ ] |
| A7 | Hardening, old admin migration | 4 | gate A7 | [ ] |
| A8 | Landing content editor, media, publish | 3 | gate A8 | [ ] |
| L1 | Landing scaffold (Next.js) | 2 | gate L1 | [ ] |
| L2 | Block components and design system | 3 | gate L2 | [ ] |
| L3 | Snapshot integration and pricing | 2 | gate L3 | [ ] |
| L4 | i18n, SEO, performance, accessibility | 2 | gate L4 | [ ] |
| L5 | Deploy pipeline and launch | 1 | gate L5 | [ ] |

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

### Admin panel decisions (see `PLATFORM-ADMIN-SPEC.md`)
| # | Decision | Options | Proposed default | Blocks |
|---|---|---|---|---|
| Q15 | Server shape for the admin panel | (a) Separate Worker `apps/platform-server` with admin API, webhooks and cron; (b) a module in the tenant API; (c) separate admin API only | (a). Hard security boundary, separate secrets and database role, separate deploys, customers unaffected by admin or webhook load. Costs about one extra phase. Fallback (b) if effort must be minimal. Tradeoff table in PLATFORM-ADMIN-SPEC 2.2. | A1 |
| Q16 | Admin sign-in | (a) Email + password + mandatory TOTP, invite only, admin-triggered password reset; (b) password only; (c) Cloudflare Access login only | (a) | A1 |
| Q17 | Network guard in front of the admin hostname | (a) None at first; (b) Cloudflare Access or IP allowlist now | (a) now, (b) as soon as you have a fixed way to reach it. | A7 |
| Q18 | Built-in admin roles | super_admin, catalog_manager, billing_admin, support, viewer, plus custom roles | As listed. | A1 |
| Q19 | Existing `/admin` routes and `users.platform_role` | (a) Rebuild in the new panel, run both, then remove; (b) keep as is | (a) | A4, A7 |
| Q19b | Editing default role grants and sidebar from the panel | (a) Overrides for labels, icons, order, hidden; grant changes only as a reviewed change request that exports a seed patch; (b) full live edit of grants | (a). Live grant edits would conflict with seeds that delete grants. | A3 |
| Q20 | Published plan changes vs existing subscribers | (a) Versioned plans; additions apply now, removals at renewal, admin may "apply now"; (b) no versioning, changes apply to everyone at once | (a). This overrides fixes plan D8. | A2, S2 schema |
| Q21 | "View as customer" (impersonation) | (a) Not in v1; (b) read-only view-as with audit | (a) | none |
| Q22 | Admin app language | (a) English; (b) English and Arabic | (a) | none |
| Q23 | Admin hostname | `admin.<your domain>` if you have a domain; otherwise a workers.dev subdomain for now | What domain should the product use? Needed for cookies, email links, provider webhooks. | A1 |
| Q24 | Reminder channels | (a) Email through the existing messaging module; (b) also WhatsApp or SMS | (a) | A6 |

### Landing site decisions (see `LANDING-SPEC.md`)
| # | Decision | Options | Proposed default | Blocks |
|---|---|---|---|---|
| Q25 | Rendering and hosting | (a) Next.js static export on Workers assets, rebuilt on publish; (b) Next.js on Workers via OpenNext with ISR; (c) Cloudflare Pages | (a). Fastest and cheapest, matches `apps/web`. Choose (b) only if you need per-request personalization. | L1 deploy, A8 |
| Q26 | How publish triggers a rebuild | (a) Platform API dispatches a GitHub Actions workflow (needs a GitHub token as a platform secret); (b) Cloudflare deploy hook; (c) manual redeploy at first | (a) later; (c) until the pipeline is approved. | L5 |
| Q27 | Draft preview | (a) Preview build on a preview hostname; (b) embedded preview in the admin using shared block components | (b) first (no extra deploy), (a) later if needed. | A8 |
| Q28 | Brand inputs | Name, logo, colors, tone, product screenshots, legal text | Needed from you before the design phase L2. I will propose a first visual direction from the app's own UI if you prefer. | L2 |
| Q29 | Landing languages | English and Arabic with RTL | Both, Arabic first-class. | L2 |
| Q30 | Analytics and forms | (a) None at first, contact form only; (b) privacy-friendly analytics (Cloudflare Web Analytics); (c) full analytics with consent | (a), then (b). | L4 |

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
- [~] **S0-01** Owner answers Q1 to Q14 and fixes-plan D1 to D8. Q1 to Q24 answered 2026-11-27 (all defaults); fixes-plan D1 to D8 still open. Done when: answers recorded in the Decisions log below.
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

### Admin track (platform admin panel)
Spec: `PLATFORM-ADMIN-SPEC.md`. A1 needs Q15, Q16, Q18, Q23. Docs only so far.

#### Phase A1: Platform apps, admin identity, roles
- [ ] **A1-01** Extract shared code into `packages/entitlements` and shared Hono middleware; scaffold `apps/platform-server` and `apps/platform-web` with their own wrangler configs and CI deploy jobs (extend the vars check). Done when: both deploy a health page to staging.
- [x] **A1-02** Schema and migration: platform_admins, sessions, roles, role_permissions, admin_roles, invites, platform_audit_events (append-only enforced in the database). Done when: migration applies; update and delete on audit table are rejected. Done 2026-11-27: migration `0030_platform_identity` (7 tables, `platform_admin_status` enum, append-only trigger on `platform_audit_events`), platform-server integration suite verifies application and UPDATE/DELETE rejection in CI.
- [x] **A1-03** `PLATFORM_MODULES` registry, permission catalog, seed of built-in roles, bootstrap CLI that issues the first invite. Done when: running it twice creates one invite. Done 2026-11-27: registry + 19 resources in `@avuny/contracts/platform-admin`, 5 built-in roles (super_admin holds every key, publish_now stays super-admin-only), idempotent `syncPlatformRoles` seed, `bootstrap:admin` CLI (24h single-use invite, hashed token, no password printed, no-op once an admin exists). Also closed the TRUNCATE hole in the audit append-only rule (migration 0031).
- [ ] **A1-04** Login, TOTP enrollment, lockout, sessions, logout, invite acceptance; no register route (PAC1, PAC2).
- [ ] **A1-05** Admin users and roles screens and routes: list, invite, disable, role editor with anti-escalation, last super admin, self-edit rules (PA-R2 to PA-R5, PAC3).
- [ ] **A1-06** Route permission guard and generated 403 test (PA-R7, PAC4); audit writes on every mutation (PAC11).
- **Gate A1**: the owner logs into the admin web, invites a second admin, who enrolls and logs in; every denial case tested.

#### Phase A2: Plan and catalog configurator (needs S2 and Q20)
- [ ] **A2-01** Catalog sync from code into `catalog_*` tables by seed, with display-field overrides kept (PAC7).
- [ ] **A2-02** Plans CRUD, versions, drafts, publish with validation and dependency closure (PA-R8 to PA-R10, PAC5).
- [ ] **A2-03** Matrix editor UI and per-plan prices and add-ons.
- [ ] **A2-04** Impact preview, history, diff, rollback; propagation rules from Q20 (additions now, removals at renewal).
- [ ] **A2-05** Public pricing preview; end-to-end check that a published plan changes a test organization's entitlements (PAC6).
- **Gate A2**: the owner builds Free, Pro, Max in the panel, publishes, and a staging organization shows the right modules and limits.

#### Phase A3: Sidebar, permissions, catalog viewer and overrides (after S1)
- [ ] **A3-01** Read-only viewer for tenant modules, actions, sidebar tree and platform permissions, derived from the registry and seed.
- [ ] **A3-02** Override storage and resolution order (override then registry) for labels, icons, order, hidden; tenant web reads them (PAC8, PA-R15).
- [ ] **A3-03** Change request flow for default grants: diff view and exported seed patch, nothing applied silently.
- **Gate A3**: an override shows up in the tenant sidebar and is reversible; no permission was removed by any UI action.

#### Phase A4: Organizations, users, subscriptions (needs S5)
- [ ] **A4-01** Organization list and detail: plan, usage vs limits, module states, subscription timeline (PA-R13, PA-R14).
- [ ] **A4-02** Organization actions: assign plan, overrides with reason and expiry, extend trial, suspend (audited).
- [ ] **A4-03** Tenant users screens, migrated from the old `/admin` routes (suspend, reactivate, revoke sessions).
- [ ] **A4-04** Subscriptions list and detail with cancel, resume, change.
- **Gate A4**: support can look up a customer and fix a plan issue without database access.

#### Phase A5: Payments and provider events (needs S6)
- [ ] **A5-01** Payments, invoices, refunds with reasons and idempotency (PA-R12).
- [ ] **A5-02** Manual bank transfer confirmation flow.
- [ ] **A5-03** Provider event ledger viewer with safe replay and secret redaction (PA-R11, PAC12).
- **Gate A5**: a failed payment and a refund are handled entirely from the panel in staging.

#### Phase A6: Jobs and reminders (dispatcher can start after A1)
- [ ] **A6-01** Tick dispatcher, `scheduled_jobs`, runs, locks, parameter validation (PAC9).
- [ ] **A6-02** Built-in jobs from PLATFORM-ADMIN-SPEC 7.2 (those whose dependencies exist), each idempotent.
- [ ] **A6-03** Templates with variables, preview, test send, locale choice, notification log (PAC10).
- [ ] **A6-04** Jobs screens: list, enable, schedule, parameters, run now, history, failures on the dashboard.
- **Gate A6**: a trial-ending reminder reaches a staging owner exactly once, in the right language.

#### Phase A7: Hardening and migration
- [ ] **A7-01** Dashboard metrics, CSV exports, audit viewer.
- [ ] **A7-02** Separate Postgres role for the platform Worker and read-only grants for the tenant Worker on plan and catalog tables (PAC13), if Q15 is option (a).
- [ ] **A7-03** Remove the old `/admin` routes and `platform_role` usage after a parallel-run period (Q19).
- [ ] **A7-04** Optional network guard (Q17), runbook, secret rotation procedure, backup admin recovery procedure.
- **Gate A7**: old admin removed, security checklist signed by the owner.

#### Phase A8: Landing content editor (needs A2; spec `LANDING-SPEC.md`)
- [ ] **A8-01** Schema and routes: site_pages, site_blocks, site_media, site_settings, site_content_versions, plan_marketing, site_matrix_rows; media upload to R2 with required alt text.
- [ ] **A8-02** Content editor UI for typed blocks, settings, media library, matrix row picker, plan marketing fields, localized fields with missing-locale warnings.
- [ ] **A8-03** Publish validation (LR1 to LR7), immutable snapshots, rollback, public read API with caching (LAC3, LAC7, LAC9).
- **Gate A8**: owner edits a headline, an image and the matrix in the admin, publishes, and the public API returns it.

### Landing track (`apps/landing`, Next.js)
#### Phase L1: Scaffold
- [ ] **L1-01** `apps/landing` with AGENTS.md, Next.js static export, Tailwind 4, locale routes, fixture snapshot, build and typecheck in CI (no deploy).
- [ ] **L1-02** Content loader with schema validation and a clear failure when the snapshot is invalid (LAC8).
- **Gate L1**: `pnpm turbo run typecheck build` passes with the fixture; nothing deployed.

#### Phase L2: Block components and design system (needs Q28)
- [ ] **L2-01** Design tokens, themes (light and dark), typography for en and ar, animated primitives with reduced-motion support.
- [ ] **L2-02** Block components for the first block set (hero, feature_grid, module_showcase, steps, faq, cta_banner, pricing, comparison_table) rendered from the fixture.
- [ ] **L2-03** Home and pricing pages composed from blocks; product mockups from app screenshots.
- **Gate L2**: owner approves the design on a preview.

#### Phase L3: Snapshot integration and pricing (needs A8)
- [ ] **L3-01** Build reads the public snapshot; pricing and matrix equal plan data (LAC1, LAC2).
- [ ] **L3-02** Interval toggle, currency switch, sign-up links carrying the chosen plan to the app.
- **Gate L3**: a plan change in the admin shows on the rebuilt site.

#### Phase L4: i18n, SEO, performance, accessibility
- [ ] **L4-01** hreflang, sitemap, robots, Open Graph, structured data; RTL screenshots (LAC4).
- [ ] **L4-02** Reduced motion, Lighthouse thresholds, keyboard and contrast checks (LAC5, LAC6).
- **Gate L4**: thresholds met on CI.

#### Phase L5: Deploy pipeline and launch (needs Q23, Q26)
- [ ] **L5-01** Cloudflare Worker for the landing, deploy workflow, publish-triggered rebuild, custom domain, rollback drill, legal pages.
- **Gate L5**: owner signs off the launch checklist.

## Risks
| Risk | Mitigation |
|---|---|
| Gating touches many modules and one is missed | Route mapping generated from the registry plus the CI guard (R9, AC2, AC3) |
| Breaking current customers | Legacy plan, snapshot built before enforcement, S2 gate is a no-op in production |
| Payment edge cases (retries, out-of-order events) | Event ledger and ordering guard, reconciliation job, fake provider tests |
| Provider not available for Egypt | S0-03 spike before any payment code; manual transfer adapter as fallback |
| Over-engineering before revenue | Phases S1 to S5 are useful without a provider; Q2 option (c) and Q5 option (c) are valid minimal launches |
| Landing shows something the plans do not contain | Pricing and matrix rendered from published plan versions only (LR4, LR5, LR7) |
| Bad content breaks the public site | Typed blocks, publish validation, schema-checked build, rollback |
| Admin panel is a powerful target | Separate Worker, hostname, identity, mandatory TOTP, least-privilege database role, append-only audit, anti-escalation rules |
| Admin edits a plan and silently changes existing customers | Versioned plans, impact preview, removals at renewal (Q20) |
| Admin overrides fight code seeds | Code owns keys, admin owns display fields and data; grant changes only via reviewed seed patch (Q19b) |
| Real transactions missing in the db driver | S0-04 and fixes plan Phase 2 gate S5 |

## Decisions log
- 2026-11-27, owner (WhatsApp, 9:29 PM Cairo): "Yes I agree with all default". Applies to every open decision in this file at that time, taken as the proposed defaults:
  Q1 Free / Pro / Max + Enterprise by contact. Q2 plan bundles plus add-ons. Q3 draft matrix as written (numbers adjustable before the S2 seed). Q4 14-day Pro trial then Free. Q5 Stripe first, then an Egyptian processor, manual transfer fallback; the S0-03 provider spike must still verify Egypt availability and VAT with sources before payment code. Q6 wind-down. Q7 onboarding module step, Inventory on by default. Q8 enterprise by admin grant. Q9 show locked modules. Q10 existing orgs on the hidden Legacy plan. Q11 one trial per owner. Q12 own sequence if local processor, else provider numbers. Q13, Q14 as proposed.
  Q15 separate Worker `apps/platform-server`. Q16 email + password + mandatory TOTP, invite only. Q17 no network guard at first. Q18 built-in roles as listed. Q19 rebuild old `/admin`, run both, then remove. Q19b overrides plus reviewed seed patch for grants. Q20 versioned plans (overrides fixes-plan D8). Q21 no view-as. Q22 admin English only. Q23 workers.dev subdomain for now. Q24 reminders by email.
- Not decided: fixes-plan D1 to D8 (still open; D1 database driver matters before S5), prices, the real domain name.

## Deviations
- 2026-11-27: the admin track (A1) starts before the S0 spikes finish, per the owner's "start implementing the admin server and web apps". S0-02 to S0-04 stay open and still gate S1/S5.

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
| 2026-11-27 | A1-02 | `pnpm --filter @avuny/platform-server test:int` (CI job "Platform API integration tests") | migration applies on a fresh database; UPDATE and DELETE on platform_audit_events raise "append-only"; status/TOTP, permission-key, email and invite check constraints hold |
| 2026-11-27 | A1-03 | contracts `vitest run src/platform-admin`; platform-server `test:int` | registry keys unique and spec-complete; built-in roles valid (PA-R1); super_admin = all keys; seed idempotent, stale grants removed, custom roles kept; bootstrap twice = one invite; TRUNCATE rejected |
