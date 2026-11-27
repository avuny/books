# SaaS Architecture (modules, plans, subscriptions, payments) - Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | decisions Q1 to Q24 answered with defaults 2026-11-27 (see PROGRESS.md); approved for scaffolding |
| Owner | Khalid (avuny) |
| Depends on | organization, organization-user, role, sidebar, activity-log, admin, the module registry (`packages/contracts/src/modules/registry.ts`) |
| Related | [`PLATFORM-ADMIN-SPEC.md`](./PLATFORM-ADMIN-SPEC.md), [`LANDING-SPEC.md`](./LANDING-SPEC.md), `../SAAS-OVERVIEW.md`, `../plan`, `../subscription`, `../payment`, `../billing`, `../feature-gate`, `../SAAS-SPEC-REVIEW.md`, `../SAAS-SPEC-FIXES-PLAN.md` |

## 0. Reading order for agents
AGENTS.md, then sections 1 to 4 of this file, then the section for the current phase. Then read the five existing SaaS specs listed above, with section 2.3 of this file telling you which parts still stand. Do not write code before the owner has answered the decisions marked "blocks" in PROGRESS.md.

## 1. Goals and non-goals

### 1.1 Why a second document
The five existing SaaS specs (2026-11-25) describe a classic plan-and-feature-flag system: one plan per organization, a flat list of features and limits, Stripe only. They do not answer the question the product now has:

> The app has many modules. A customer may want only a few of them. Plans (free, pro, max, ...) include different modules and limits. The customer subscribes and pays. How does one codebase do all of that safely?

This spec adds the missing layer, the **module catalog and entitlement model**, and ties the existing specs into one phased plan. It does not repeat the existing specs; it overrides them only where section 2.3 says so.

### 1.2 Goals
1. A tenant (organization) uses only the modules it needs. Switched-off modules disappear from the UI, the API, the role editor and reports, and cost nothing.
2. A plan is a named bundle of entitlements: modules, features inside modules, and numeric limits. Plans, prices and bundles are data, changeable without a deploy.
3. One resolver answers every question ("may this org use X?", "how many Y may it have?"). Backend, frontend and background jobs all use it. No module reads a plan or a subscription directly.
4. Organizations subscribe, trial, upgrade, downgrade, cancel and pay. Money flow sits behind a provider port so Stripe, a local Egyptian processor and manual bank transfer can coexist.
5. Existing customers and data are never broken by the rollout. Nothing is deleted when a module is switched off or a plan is downgraded.
6. Everything ships in phases. The first phases (catalog, entitlements, module switches, gating) deliver value before any payment code exists.

### 1.3 Non-goals (v1)
- Per-seat metered usage billing, usage-based pricing, marketplace or reseller billing.
- Custom per-customer price negotiation in self-serve (admin grants cover enterprise, see Q8).
- The platform admin back office is specified separately in `PLATFORM-ADMIN-SPEC.md`; this document defines the data and rules it edits.
- Multi-product platform (a second product besides Books). The catalog is designed so it could grow, not built for it.
- Changing the accounting, inventory or purchasing behavior of any module.

## 2. Architecture

### 2.1 Concepts and vocabulary
Use these words exactly; they are the keys used in code, tables and tests.

| Term | Meaning | Example |
|---|---|---|
| Module (product module) | A unit a customer understands and can switch on or off. Groups one or more registry modules (permission resources). | `purchasing`, `inventory_advanced`, `accounting` |
| Registry module | One key in `MODULES` (registry.ts): a permission resource with actions and optionally a sidebar entry. | `purchase_order`, `batch` |
| Feature | A boolean or enum capability inside a module. | `inventory.batch_tracking`, `accounting.level = basic or full` |
| Limit | A numeric quota, `-1` means unlimited. | `limit.items = 500` |
| Entitlement | One resolved answer for an organization: a module, feature or limit value. Keys: `module.<key>`, `feature.<name>`, `limit.<name>`. | `module.purchasing = true` |
| Plan | A named bundle of entitlements plus prices. Global, platform-owned. | Free, Pro, Max |
| Add-on | An optional paid increment on a plan: an extra module or a limit increase. | "+1,000 items" |
| Override | An admin-granted entitlement for one organization, with reason and optional expiry. | Support grants 30 days of Pro features |
| Switch | The organization owner turning an entitled module on or off. | Owner disables sales |
| Subscription | The billing relationship: plan, add-ons, status, period. Owned by the subscription module. | See `../subscription/SPEC.md` |
| Snapshot | The resolved entitlements of one organization, stored and versioned. | `organization_entitlements` |

### 2.2 Layers

```
 Registry (code)          Catalog (code, derived)         Commercial (data)
 registry.ts MODULES  ->  MODULE_CATALOG: product     ->  plans, plan_entitlements,
 permission resources     modules, dependencies,          prices, add-ons
                          features, limits                      |
                                                                v
 Subscription (data)  ->  Resolver  ->  organization_entitlements (snapshot, version n)
 status, period, add-ons   plan + add-ons + overrides             |
                           + switches + dependencies              v
                                          Enforcement points: API middleware, service limit
                                          checks, sidebar, role catalog, web hooks, jobs

 Money: Subscription -> BillingProvider port -> Stripe | local processor | manual
                       provider events -> event ledger -> state machine -> resolver
```

Rules of the layering:
- The **catalog** is code. It says what exists: which modules, what depends on what, which features and limits are enforceable. A feature that no code enforces must not be in the catalog (this answers review item 17 and 26 in SAAS-SPEC-REVIEW.md).
- The **commercial layer** is data. It says who gets what: plans, entitlements per plan, prices. It may only reference catalog keys. A seed or admin write that references an unknown key fails.
- The **resolver** is the only code that combines them. Everything else reads the snapshot.
- The **provider port** is the only code that knows Stripe or any processor. The state machine does not.

### 2.3 What stays from the existing specs, what changes
| Existing spec | Status under this spec |
|---|---|
| `plan/SPEC.md` | Stands for plans, prices, add-ons. Changes: features and limits become rows of `plan_entitlements` with the three key kinds; modules are added as `module.*` entitlements; the plan ladder follows decision Q1; `numeric(12,2)` money becomes minor units (already required by the fixes plan D2). |
| `subscription/SPEC.md` | Stands for lifecycle, trials, proration, one active subscription (partial unique index). Changes: adds the `restricted` and `suspended` access states (section 3.3); enterprise self-serve stays excluded (fixes plan D7). |
| `payment/SPEC.md` | Stands for payment methods, charges, refunds, webhook safety (event ledger, raw body, fetch HTTP client). Changes: wrapped behind the `BillingProvider` port (section 6.1) so Stripe is one adapter; local processor and manual transfer are further adapters. |
| `billing/SPEC.md` | Stands for invoices, credits, proration. Changes: invoice numbering per organization decision Q12. |
| `feature-gate/SPEC.md` | Superseded in part. Its `hasFeature`, `checkLimit(scope, key)` and `getFeatureValue` stay as the public API, but they now read the snapshot, not the plan directly, and add `isModuleEnabled`. The 5 minute in-memory cache is removed (fixes plan 4.2). |
| `SAAS-SPEC-FIXES-PLAN.md` | Stands. Its Phase 0 decisions D1 to D8 are still open; this spec adds Q1 to Q14, and the admin panel spec adds Q15 to Q24. D8 is overridden by Q20. Its Phase 2 (real database transactions) is a hard prerequisite for phase S5. |

### 2.4 Module catalog (proposed first cut)
Grouped from the current registry. "Core" modules are always on and not switchable. Dependencies are proposed from the registry and the domain; phase S1 verifies each one by scanning real imports and writes the result into the catalog, so treat this table as a draft to correct.

| Product module | Registry modules | Switchable | Depends on | Notes |
|---|---|---|---|---|
| `core` | organization, organization_user, organization_invitation, role, activity_log, users | no | none | Custom roles is a feature (`feature.custom_roles`). Audit retention is a visibility window, never deletion (fixes plan D4). |
| `inventory` | item, item_category, unit, unit_collection, warehouse, warehouse_location, stock_movement, inventory_adjustment | yes, default on | core | Extra units per collection is `feature.extra_units`. Adjustment cap (if kept) follows fixes plan D5. |
| `inventory_advanced` | batch, inventory_transfer, inventory_reservation | yes | inventory | Batch tracking is `feature.batch_tracking`. |
| `inventory_costing` | inventory_costing | yes | inventory | Spec in PR #55. Weighted average vs FIFO choice may be a feature of this module. |
| `purchasing` | vendor, purchase_order, purchase_receipt, purchase_shipment, vendor_bill, vendor_payment, payment_term | yes | inventory | Posting to accounting is a soft dependency: works without `accounting`, posts journals when it is on. Confirm in S1. |
| `sales` | customer, sales documents (future) | yes | inventory | Only customers exist today. Future documents must register here, not as new gates. |
| `accounting` | accounting | yes | core | `feature.accounting_level` is `basic` or `full`; "basic" must be written down before seeding (review item 5). |
| `assembly` | assembly, bill_of_materials (future) | yes | inventory_costing | Specs on branches, not built. |
| `platform` | API access, SSO, custom branding | no, feature-only | core | Features only, no registry modules yet. Add when enforceable. |

Party (customers and vendors) shares tables. The catalog tracks `customer` and `vendor` as separate registry modules, so a tenant can use vendors without customers. The shared `party` table stays always present.

### 2.5 Tenant model
- Entitlements attach to the **organization** (the tenant), not the user.
- The subscription owner is the organization. The billing contact is the owner member. Only the owner role may manage subscription and billing (existing rule, SAAS-OVERVIEW 6.2).
- User-scoped limits (organizations a user may own) resolve against the user's best plan. The existing `maxOwnedPerUser` hook maps to `limit.orgs_per_user`, scope `userId` (review item 4). Rule: the user's cap is the highest cap among organizations they own, and the Free default when they own none. Decision Q13.
- Portal users do not count against the managed member limit (review item 6).

## 3. Lifecycle and status model

### 3.1 Subscription status
Unchanged from `subscription/SPEC.md`: `created`, `trialing`, `active`, `past_due`, `canceling`, `canceled`, `expired`. Only the first five are "live" and unique per organization (partial unique index).

### 3.2 Organization access state
Status describes billing. Access state describes what the organization may do. They are separate so billing problems do not instantly lock users out of their own data.

| Access state | When | What the tenant can do |
|---|---|---|
| `full` | trialing, active, canceling (until period end), or no subscription on a plan that allows it (Free) | Everything the snapshot allows |
| `grace` | `past_due` within the grace window, or downgrade over-limit window | Everything, with banners. No new entitlements are granted. |
| `restricted` | grace expired, or subscription canceled or expired and the org exceeds Free entitlements | Read and export everywhere. Creating or posting is blocked in modules or counts beyond the Free entitlements. Owner can always reach billing and the plan page. |
| `suspended` | platform admin action only (fraud, abuse), org status `suspended` | Owner sees a notice. Nothing else. |

Rules: money problems never reach `suspended`. Data is never deleted by any state. Downgrading to Free yields `restricted` only for what exceeds Free, not for the whole organization.

### 3.3 Module state per organization
For each switchable module the resolver outputs one of:

| State | Meaning |
|---|---|
| `enabled` | entitled, switched on, dependencies enabled |
| `off` | entitled but switched off by the owner (or never switched on) |
| `locked` | not entitled by plan, add-on or override. Shown with an upgrade prompt, not hidden, when `showLocked` is true for the module (Q9). |
| `blocked_by_dependency` | entitled and on, but a module it depends on is not enabled |
| `winding_down` | was enabled, now not entitled or switched off: data readable, no new documents, open documents can be completed or cancelled (Q6) |

Transitions: owner switch, subscription change, override change, dependency change. Every transition writes an activity-log event (`module_enabled`, `module_disabled`) and bumps the snapshot version.

## 4. Business rules
Tests reference these ids.

### Entitlements and resolution
- **R1** Effective entitlement for key K = plan value, then plus add-on increments (limits) or add-on grants (modules, features), then admin override replaces the result last (fixes plan 1.13).
- **R2** A module is `enabled` only if: entitled, switched on, and every dependency is `enabled`. Core modules are always `enabled`.
- **R3** Enabling a module whose dependency is `off` but entitled offers to enable both in one action. Enabling a module whose dependency is `locked` is rejected with `MODULE_DEPENDENCY_LOCKED` and names the missing module.
- **R4** Disabling a module that others depend on is rejected with `MODULE_REQUIRED_BY` listing them, unless the owner disables the dependents in the same action.
- **R5** The snapshot is recomputed in the same transaction as any change to subscription, add-ons, overrides or switches, and its `version` increases. Readers compare versions; there is no time-based cache (fixes plan 4.2).
- **R6** An unknown catalog key in a plan, add-on, override or seed is rejected at write time (`ENTITLEMENT_KEY_UNKNOWN`).
- **R7** A catalog feature or limit must name the code path that enforces it (`enforcedBy`). A test fails if a seeded key has no `enforcedBy`.
- **R8** Every organization always has a resolvable snapshot. With no subscription, the snapshot is the Free plan, or the Legacy plan for organizations that existed before rollout (R20).

### Enforcement
- **R9** Every route of a switchable module is mounted behind `requireModule(key)`; the route table is generated from the registry mapping, so a new registry module cannot ship un-gated (test in S3).
- **R10** A blocked request fails with HTTP 403 and error code `MODULE_NOT_ENABLED` (switched off or locked) or `FEATURE_NOT_IN_PLAN` or `LIMIT_REACHED`. The body names the key, the state, and the plan that would unlock it. It never reveals other plans' prices.
- **R11** Limits are checked in the service layer, inside the write transaction, with a scope (`orgId`, `userId` or `warehouseId`). A limit check counts rows with the real active-flag columns per table (fixes plan 1.2).
- **R12** Reaching a limit blocks creation only. Updates, reads and deletes of existing rows always work, so a customer over the limit can get back under it.
- **R13** The sidebar, the role editor's permission catalog, global search, dashboards and report lists show only `enabled` modules. `locked` modules appear in the sidebar only as upgrade prompts when `showLocked`.
- **R14** Role permissions on a non-enabled module are kept in the database but inert. Re-enabling the module restores them as they were. No permission is deleted by a plan change.
- **R15** Background jobs, imports and the API client check entitlements the same way as the web app. There is no "internal" path that skips the gate, except platform admin tools.

### Subscription and money
- **R16** Only the organization owner can change the subscription, add-ons, payment methods and module switches that cost money.
- **R17** Plan changes: upgrades apply immediately with proration credit. Downgrades apply at the end of the period (fixes plan D8). Downgrade preview lists exactly what would become `winding_down` or over limit, before the owner confirms.
- **R18** Provider events are written to the event ledger (unique provider event id) before any handler logic, and applied only if newer than the last applied event for that subscription (fixes plan 1.11, 1.12).
- **R19** Prices live per currency and per interval in plan prices. There is no runtime exchange rate. Showing a converted price is display only.
- **R20** Rollout safety: on migration every existing organization is assigned the `legacy` plan: every module on, every limit unlimited, hidden from the pricing page, not purchasable. It lets the platform ship the engine without changing any current customer. How and when legacy organizations move to real plans is decision Q10.
- **R21** Trial eligibility is stored on the organization (fixes plan 1.7). One trial per organization, and a documented rule for the same owner creating a second organization (Q11).
- **R22** Every entitlement change, switch and plan change is audited: who, what, before, after, reason.

## 5. Database design (proposed)
All money columns are `bigint` minor units with `currency char(3)` via `money()` and `currency()` helpers. Every tenant row has `org_id`. Names follow existing schema folders; new folder `packages/db/src/schema/billing/`.

| Table | Purpose | Key columns |
|---|---|---|
| `plans` | Global catalog | `code` unique, `name`, `tier` int, `is_public`, `is_purchasable`, `trial_days`, `sort`, `metadata` |
| `plan_prices` | Price per plan, currency, interval | `plan_id`, `currency`, `interval`, `amount_minor`, `provider_price_ref`, `is_active` |
| `plan_entitlements` | What a plan includes | `plan_id`, `key` (catalog key), `kind` (module, feature, limit), `value` jsonb (bool, string or int), unique `(plan_id, key)` |
| `addons` | Purchasable increments | `code`, `kind` (module, feature, limit), `key`, `increment`, `is_active` |
| `addon_prices` | Same shape as plan prices | `addon_id`, `currency`, `interval`, `amount_minor` |
| `subscriptions` | Existing spec; partial unique index on live statuses | `org_id`, `plan_id`, `status`, `provider`, `provider_subscription_ref`, `current_period_start/end`, `cancel_at_period_end`, `last_event_at` |
| `subscription_addons` | Add-ons on a subscription | `subscription_id`, `addon_id`, `quantity` |
| `organization_modules` | Owner switches | `org_id`, `module_key`, `enabled`, `changed_by`, `changed_at`, unique `(org_id, module_key)` |
| `organization_entitlement_overrides` | Admin grants | `org_id`, `key`, `value`, `reason`, `granted_by`, `expires_at` |
| `organization_entitlements` | Snapshot | `org_id` unique, `version` int, `resolved` jsonb, `computed_at`, `access_state` |
| `plan_versions`, `catalog_modules`, `catalog_features`, `catalog_limits`, `scheduled_jobs`, `notification_templates` | Added for the admin panel: versioned plans (`subscriptions.plan_version_id`), editable catalog display fields, jobs, reminder texts. See `PLATFORM-ADMIN-SPEC.md` sections 4 and 7. |
| `provider_events` | Event ledger | `provider`, `event_id`, `type`, `received_at`, `processed_at`, `payload` jsonb, unique `(provider, event_id)` |
| `invoices`, `invoice_lines`, `payments`, `refunds`, `credits` | As in `../billing` and `../payment`, with minor units | see those specs |

Added to `organizations`: `trial_used_at`, `limits_grace_until` (fixes plan 3.1). Plan versioning is now IN scope because admins edit plans live (`PLATFORM-ADMIN-SPEC.md` 4.3, decision Q20); this overrides fixes plan D8.

Index and consistency notes:
- Subscription row, subscription event and invoice writes are atomic (needs real transactions, fixes plan Phase 2).
- The snapshot update happens inside the transaction that changed its inputs.
- `organization_modules` rows are created lazily; a missing row means "default for the module" (`defaultOn` in the catalog).

## 6. Contracts and API

### 6.1 Ports
```
EntitlementResolver   resolve(orgId) -> Snapshot            (pure over loaded inputs; unit-testable)
EntitlementService    getSnapshot(orgId), isModuleEnabled(orgId, key), hasFeature(orgId, key),
                      getFeatureValue(orgId, key), checkLimit(scope, key), setModuleSwitch(...)
BillingProvider       createCustomer, createCheckout, changePlan, cancel, listPaymentMethods,
                      refund, parseWebhook(rawBody, headers) -> ProviderEvent[]
```
`BillingProvider` adapters: `stripe`, `local` (one Egyptian processor, chosen in Q5), `manual` (bank transfer: owner submits proof, platform admin confirms, subscription activates). All adapters produce the same `ProviderEvent` shapes, so the state machine is provider-agnostic.

### 6.2 Endpoints (proposed; permission per endpoint in section 8)
| Route | Purpose |
|---|---|
| `GET /organizations/:orgId/entitlements` | Snapshot for the web app: modules with state, features, limits with usage, access state, version |
| `GET /organizations/:orgId/entitlements/check?key=` | Single key check (reconciles review item 22) |
| `PUT /organizations/:orgId/modules/:moduleKey` | Owner switch on or off (R2 to R4) |
| `GET /plans` | Public catalog for the pricing page |
| `POST /organizations/:orgId/subscription/preview` | What a plan or add-on change would do (R17) |
| subscription, payment and billing routes | As in their specs, behind the provider port |
| `POST /webhooks/:provider` | Signature-verified raw-body webhook, mounted outside auth and JSON parsing |
| Platform admin routes (plans, overrides, organizations, jobs) | Not in the tenant API. They live in the platform API, see `PLATFORM-ADMIN-SPEC.md`. The tenant API only reads the catalog, plans and snapshots. |

Error codes (UPPER_SNAKE): `MODULE_NOT_ENABLED`, `MODULE_DEPENDENCY_LOCKED`, `MODULE_REQUIRED_BY`, `FEATURE_NOT_IN_PLAN`, `LIMIT_REACHED`, `ENTITLEMENT_KEY_UNKNOWN`, `PLAN_NOT_PURCHASABLE`, `SUBSCRIPTION_ACCESS_RESTRICTED`.

### 6.3 Idempotency
Webhooks by `(provider, event_id)`. Checkout creation by a client idempotency key. Module switches are idempotent by target state.

## 7. UI
- **Settings, Modules**: list of modules with state, one switch each, dependency hints, what turning off does ("existing data is kept, new documents blocked"). Owner only.
- **Settings, Plan and billing**: current plan, next renewal, usage bars against limits, add-ons, payment methods, invoices, cancel. Downgrade preview before confirming.
- **Pricing page** (public): plans, price per currency and interval, module comparison grouped by product module.
- **In-app**: `<Gate module|feature|limit>` component and `useEntitlement(key)` hook; upgrade prompts and limit banners; locked sidebar entries when `showLocked`; trial and grace banners.
- **Onboarding**: after creating an organization, "Which modules do you need?" step with defaults by business type (Q7). Skippable, changeable later.
- All strings in `en.json` and `ar.json`, RTL checked. Copy never says "plan" where it means "module".

## 8. Permissions
New registry modules: `subscription` (read, manage), `billing` (read, manage), `entitlement` (read), `organization_module` (read, update). Default grants: owner role gets all; other built-in roles get `read:entitlement` only. The platform admin back office has its own identity, roles and audit trail (`PLATFORM-ADMIN-SPEC.md`), not tenant roles.

## 9. Accounting and inventory effects
None for tenants' books. The platform's own invoices live in the billing tables, not in a tenant's chart of accounts. Module switching never alters posted data. Disabling `accounting` while `purchasing` posts journals is handled by the soft dependency rule: posting is skipped with a clear `JOURNAL_NOT_POSTED_MODULE_OFF` marker, and enabling accounting later offers a backfill (only if Q14 is yes).

## 10. Reporting and reconciliation
- Platform metrics: MRR, active subscriptions by plan, trial conversion, churn, failed payment rate, module adoption (how many organizations enable each module), limit-hit counts. These drive the next pricing decision.
- Reconciliation job: provider subscription status against local status, daily; mismatches reported, not auto-fixed.
- Snapshot drift check: recompute all snapshots in a test or job and compare to stored version.

## 11. Acceptance criteria
- **AC1** Resolver unit tests cover R1 to R8 including add-ons, overrides, dependency chains and unknown keys.
- **AC2** Every switchable registry module's routes return `MODULE_NOT_ENABLED` for an organization with the module off or locked, and work when on (R9), proven by a generated test across the registry.
- **AC3** A new registry module without a catalog mapping fails CI.
- **AC4** Limit checks block creation at the limit and allow updates, reads and deletes (R11, R12), under concurrent creates (no overshoot beyond one race, documented).
- **AC5** Switching a module off hides it from sidebar, role editor and search, keeps data and role grants, and switching it on restores them (R13, R14).
- **AC6** Existing organizations behave identically after rollout (R20): the full integration suite passes unchanged with every org on `legacy`.
- **AC7** Upgrade, downgrade preview, downgrade at period end, cancel, and failed payment to grace to restricted work end to end with a fake provider.
- **AC8** Replayed, reordered and duplicated webhooks never move a subscription backward or double-apply (R18).
- **AC9** Tenant isolation: organization A cannot read or change organization B's entitlements, modules, subscription or invoices.
- **AC10** Every state change writes an audit entry with before and after (R22).
- **AC11** en and ar parity, no raw keys, RTL screenshots for the three main screens.
- **AC12** A real provider test-mode checkout completes in staging for each launched adapter.

## 12. Implementation tasks
Phases and tasks are tracked in PROGRESS.md. Summary:

| Phase | Title | Ships value without money? |
|---|---|---|
| S0 | Decisions and spikes | n/a |
| S1 | Module catalog in code | yes: dependency graph, CI guard |
| S2 | Entitlement core: schema, resolver, legacy plan | yes: invisible, safe |
| S3 | Enforcement: middleware, sidebar, role catalog, limits | yes |
| S4 | Module management UI and gating UI | yes: tenants pick modules |
| S5 | Subscriptions and lifecycle with admin grants and fake provider | yes: plans assignable by hand |
| S6 | Payments: provider port, first adapter, webhooks, invoices | revenue starts |
| S7 | Billing UI, pricing page, dunning, scheduled jobs | self-serve complete |
| S8 | Hardening and launch | |

The platform admin track (A1 to A7) runs alongside S1 to S7; see `PLATFORM-ADMIN-SPEC.md` section 12 and PROGRESS.md.

Rough order of effort, to plan around (not a promise): S1 small, S2 medium, S3 large (touches many modules), S4 medium, S5 medium, S6 large (provider specifics), S7 medium, S8 medium.

Dependencies from the fixes plan: its Phase 2 (real transactions) must land before S5; its Phase 4 (cron triggers, no in-memory cache, Stripe fetch client, raw webhook body) before S6 and S7.

## 13. Repository checks before implementation
Run before S1 and record the output in PROGRESS.md:
1. `packages/contracts/src/modules/registry.ts`: confirm every module key and which are commented out (sales, invoice).
2. Import scan between `apps/server/src/api/modules/*` to find real cross-module dependencies for the catalog.
3. The `PlanFeatures`, `UnitCollectionPlanFeatures`, `OrganizationLimits` ports and every `Dummy*` wiring (`deps.ts`, `testing.ts`).
4. `organizations` schema for the `billing account` mentioned in the schema comment: confirm whether a table exists. At review time no billing schema folder exists.
5. `apps/server/wrangler.jsonc`: no cron triggers, plain vars in git, secrets set outside.
6. How the sidebar seed and role permission catalog are derived, so filtering by module state hooks in at one place.
7. Whether the database driver now supports transactions (fixes plan Phase 2).

## 14. Decisions to preserve
- Entitlements are resolved in one place and stored as a versioned snapshot; no module reads plans.
- Modules are switchable per organization; plans decide what is allowed, owners decide what is on.
- The catalog is code, plans are data, and data may only reference the catalog.
- Data is never deleted by a plan change, switch or billing state. Over-limit means blocked creation, not lost rows.
- Money problems lead to restricted access, never to suspended access.
- Billing providers sit behind one port; the state machine is provider-agnostic.
- Existing customers start on a `legacy` all-access plan so rollout changes nothing for them.
- Prices are per currency; no runtime exchange rates.
