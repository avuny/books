# SaaS Monetization — Architecture Overview

> **Status**: Specification · v1.0 · 2026-11-25
> **Scope**: Plans, subscriptions, payments, billing, and feature-gating for the Avuny Books multi-tenant monorepo.

---

## 1. Vision

Avuny Books is a multi-tenant inventory, accounting, and business management platform. Today every organization gets unrestricted access to every feature. This specification introduces a **tiered plan system** that:

1. Defines what each plan includes (features, limits, add-ons).
2. Gates backend services and frontend UI based on the active plan.
3. Manages subscriptions with trial, upgrade, downgrade, cancellation, and renewal flows.
4. Processes payments through Stripe (cards, regional methods) and manual/bank-transfer for enterprise.
5. Generates invoices, tracks billing history, and handles proration.

---

## 2. Module Map

```
┌────────────────────────────────────────────────────────────────────┐
│                        SaaS Layer                                  │
│                                                                    │
│  ┌─────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Plan    │  │ Subscription │  │ Payment  │  │   Billing    │   │
│  │  Module  │──│    Module    │──│  Module  │──│   Module     │   │
│  │         │  │              │  │          │  │              │   │
│  │ Tiers   │  │ Lifecycle    │  │ Stripe   │  │ Invoices     │   │
│  │ Features│  │ Trials       │  │ Webhooks │  │ Credits      │   │
│  │ Limits  │  │ Proration    │  │ Refunds  │  │ Usage        │   │
│  │ Add-ons │  │ Renewals     │  │ Methods  │  │ History      │   │
│  └────┬────┘  └──────┬───────┘  └─────┬────┘  └──────┬───────┘   │
│       │              │                │               │           │
│  ┌────┴──────────────┴────────────────┴───────────────┴────────┐  │
│  │                   Feature Gate Module                        │  │
│  │  Replaces DummyPlanFeatures · enforces limits in services   │  │
│  │  Drives UI visibility (upgrade prompts, disabled buttons)   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
   ┌─────────────────┐        ┌──────────────────┐
   │ Existing Modules │        │   Organization   │
   │ (item, warehouse,│        │   (tenant root)  │
   │  role, party, …) │        │                  │
   └─────────────────┘        └──────────────────┘
```

| Module | Contract | Server | Purpose |
|--------|----------|--------|---------|
| **Plan** | `packages/contracts/src/plan/` | `apps/server/src/api/modules/plan/` | Define tiers, features, limits, pricing, add-ons |
| **Subscription** | `packages/contracts/src/subscription/` | `apps/server/src/api/modules/subscription/` | Lifecycle: create, trial, activate, upgrade, downgrade, cancel, renew |
| **Payment** | `packages/contracts/src/payment/` | `apps/server/src/api/modules/payment/` | Stripe integration, payment methods, charge processing, refunds, webhooks |
| **Billing** | `packages/contracts/src/billing/` | `apps/server/src/api/modules/billing/` | Invoice generation, billing history, credits, proration calculations |
| **Feature Gate** | `packages/contracts/src/feature-gate/` | `apps/server/src/api/modules/feature-gate/` | Runtime enforcement of plan features/limits in every module's service layer |

---

## 3. Plan Tiers

### 3.1 Tier Definitions

| Tier | Code | Target | Price (USD/mo) | Billing |
|------|------|--------|----------------|---------|
| **Free** | `free` | Solo freelancers, evaluation | \$0 | — |
| **Starter** | `starter` | Small businesses, 1-5 users | \$19 | Monthly / Annual (2 months free) |
| **Pro** | `pro` | Growing businesses, 5-20 users | \$49 | Monthly / Annual |
| **Business** | `business` | Mid-market, 20-50 users | \$99 | Monthly / Annual |
| **Enterprise** | `enterprise` | Large orgs, custom needs | Custom | Annual / Custom |

### 3.2 Feature Matrix

| Feature | Free | Starter | Pro | Business | Enterprise |
|---------|------|---------|-----|----------|------------|
| **Organizations** | 1 | 2 | 5 | 10 | Unlimited |
| **Members per org** | 2 | 5 | 20 | 50 | Unlimited |
| **Items** | 50 | 500 | 5,000 | 25,000 | Unlimited |
| **Warehouses** | 1 | 3 | 10 | 25 | Unlimited |
| **Locations per warehouse** | 5 | 20 | 100 | 500 | Unlimited |
| **Customers** | 20 | 200 | 2,000 | 10,000 | Unlimited |
| **Vendors** | 10 | 100 | 1,000 | 5,000 | Unlimited |
| **Custom roles** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Unit collections** | 3 | 10 | 50 | Unlimited | Unlimited |
| **Extra units per collection** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Inventory adjustments / mo** | 10 | 100 | 1,000 | 10,000 | Unlimited |
| **Batch tracking** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Inventory reservations** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Accounting (chart of accounts)** | ✗ | Basic | Full | Full | Full |
| **Sales orders** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Invoicing** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Purchase orders** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Multi-currency** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **API access** | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Audit log retention** | 7 days | 30 days | 90 days | 1 year | Unlimited |
| **Email support** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Priority support** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Dedicated support** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Custom branding** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **SSO (SAML/OIDC)** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Data export** | CSV | CSV | CSV, Excel | CSV, Excel, API | Full API + Bulk |

### 3.3 Add-ons (purchasable on any paid plan)

| Add-on | Code | Price | Description |
|--------|------|-------|-------------|
| Extra members | `addon-members-5` | \$5/mo per 5 | Add 5 member seats |
| Extra items | `addon-items-1000` | \$10/mo per 1,000 | Increase item limit |
| Extra warehouses | `addon-warehouses-5` | \$15/mo per 5 | Add 5 warehouses |
| Advanced reports | `addon-reports` | \$20/mo | Custom reports & dashboards |
| White-label | `addon-whitelabel` | \$50/mo | Remove Avuny branding |

---

## 4. Integration with Existing Infrastructure

### 4.1 Existing Plan Feature Hooks

The codebase already has **port interfaces** for plan features that are currently stubbed:

| Module | Interface | Feature Key | Current Implementation |
|--------|-----------|-------------|----------------------|
| `role` | `PlanFeatures` | `customRoles` | `DummyPlanFeatures` → always `true` |
| `unit-collection` | `UnitCollectionPlanFeatures` | `extraUnits` | `DummyUnitCollectionPlanFeatures` → always `true` |
| `organization` | `OrganizationLimits` | `maxOwnedPerUser` | Hardcoded limit |

### 4.2 Integration Strategy

1. **Unify all feature/limit interfaces** behind a single `FeatureGateService`.
2. **Replace all `Dummy*` implementations** in `deps.ts` files with real `FeatureGateService` calls.
3. **Add limit checks** to modules that currently have none (item, warehouse, party, warehouse-location).
4. **Frontend**: use a `usePlanFeature(feature)` hook and `<PlanGate feature="..." />` component.

---

## 5. Document Index

| Document | Description |
|----------|-------------|
| [Plan Module SPEC](./plan/SPEC.md) | Plan tiers, features, limits, pricing — the product catalog |
| [Subscription Module SPEC](./subscription/SPEC.md) | Subscription lifecycle, trials, upgrades, downgrades, cancellations |
| [Payment Module SPEC](./payment/SPEC.md) | Stripe integration, payment methods, charges, refunds, webhooks |
| [Billing Module SPEC](./billing/SPEC.md) | Invoice generation, billing history, credits, proration |
| [Feature Gate Module SPEC](./feature-gate/SPEC.md) | Runtime feature/limit enforcement, frontend plan gating |
| [Implementation Plan](./IMPLEMENTATION-PLAN.md) | Phased rollout, dependencies, task breakdown |
| [SaaS Architecture (modules and entitlements)](./saas-architecture/SPEC.md) | Module catalog, entitlement resolver, plan bundles, tenant module switches, provider port, phased plan S0 to S8. Proposed; adds to and in places supersedes the documents above (see its section 2.3). Decisions and progress: [PROGRESS](./saas-architecture/PROGRESS.md) |
| [Platform Admin (back office)](./saas-architecture/PLATFORM-ADMIN-SPEC.md) | Separate admin web app and API: admin login and roles, plan and feature configurator, organizations, subscriptions, payments, sidebar and permission catalog, scheduled jobs and reminders. Proposed. |
| [Marketing Landing Site](./saas-architecture/LANDING-SPEC.md) | Next.js static landing site whose text, images and plan matrix are edited in the admin and published as a snapshot. Proposed. |

---

## 6. Cross-Cutting Concerns

### 6.1 Database
- All billing tables live under a `billing` schema group in `packages/db/src/schema/billing/`.
- Every table hangs off `org_id` (the tenant).
- Financial records are **never hard-deleted** (soft delete + audit trail).

### 6.2 Security
- Payment tokens never touch our database; Stripe holds them.
- Webhook endpoints validate Stripe signatures.
- Plan changes are logged in the activity log.
- Only the organization owner can manage subscriptions and billing.

### 6.3 Localization
- All plan names, feature descriptions, and billing strings are in `en.json` / `ar.json`.
- Prices are displayed in the organization's `defaultCurrency` where possible; USD is the billing currency.

### 6.4 Compliance
- Invoices include tax information where required.
- GDPR: billing data retention follows data retention policies.
- PCI DSS: handled by Stripe (we never store card numbers).
