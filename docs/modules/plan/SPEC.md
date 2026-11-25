# Plan Module — Specification

> **Version**: 1.0 · 2026-11-25
> **Status**: Specification
> **Parent**: [SaaS Overview](../SAAS-OVERVIEW.md)

---

## 1. Purpose

The Plan module defines the **product catalog** of Avuny Books: what tiers exist, what features each tier includes, what resource limits apply, and what add-ons are available. It is the single source of truth that every other SaaS module reads from.

Plans are **global, platform-level entities** — not per-organization. An organization's active plan is determined by its subscription (see [Subscription SPEC](../subscription/SPEC.md)).

---

## 2. Domain Model

### 2.1 Plan Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `code` | text | Unique slug: `free`, `starter`, `pro`, `business`, `enterprise` |
| `name` | text | Display name (localized via locale files) |
| `description` | text | Marketing description |
| `tier` | integer | Sort order / hierarchy (0 = free, 1 = starter, …) |
| `isActive` | boolean | Whether new subscriptions can select this plan |
| `isPublic` | boolean | Whether this plan appears on the public pricing page |
| `trialDays` | integer | Default trial period (0 = no trial) |
| `metadata` | jsonb | Arbitrary key-value for future extensibility |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last update |

### 2.2 Plan Price Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `planId` | UUID | FK → plans |
| `currency` | char(3) | ISO 4217 currency code (e.g., `USD`, `SAR`) |
| `interval` | enum | `monthly`, `yearly`, `one_time` |
| `amount` | numeric(12,2) | Price amount in the currency's major unit |
| `stripePriceId` | text | Stripe Price object ID (e.g., `price_xxx`) |
| `isActive` | boolean | Whether this price is currently available |
| `createdAt` | timestamp | Creation time |

### 2.3 Plan Feature Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `planId` | UUID | FK → plans |
| `featureKey` | text | Machine-readable key (e.g., `customRoles`, `batchTracking`, `multiCurrency`) |
| `enabled` | boolean | Whether the feature is included in this plan |
| `metadata` | jsonb | Feature-specific config (e.g., `{ "accountTypes": ["basic"] }` for accounting) |

### 2.4 Plan Limit Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `planId` | UUID | FK → plans |
| `limitKey` | text | Machine-readable key (e.g., `maxItems`, `maxWarehouses`, `maxMembers`) |
| `value` | integer | Limit value; `-1` = unlimited |

### 2.5 Add-on Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `code` | text | Unique slug (e.g., `addon-members-5`) |
| `name` | text | Display name |
| `description` | text | What the add-on provides |
| `limitKey` | text | null | Which limit this add-on extends (null for feature add-ons) |
| `limitIncrement` | integer | null | How much the limit increases per purchase |
| `featureKey` | text | null | Which feature this add-on enables (null for limit add-ons) |
| `isActive` | boolean | Whether the add-on is currently purchasable |
| `createdAt` | timestamp | Creation time |

### 2.6 Add-on Price Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `addonId` | UUID | FK → addons |
| `currency` | char(3) | ISO 4217 |
| `interval` | enum | `monthly`, `yearly` |
| `amount` | numeric(12,2) | Price amount |
| `stripePriceId` | text | Stripe Price object ID |
| `isActive` | boolean | Whether available |

---

## 3. Feature Key Registry

All feature keys used across the codebase. Adding a new gated feature means adding a row here and in the plan_features seed.

| Key | Type | Description | Modules affected |
|-----|------|-------------|-----------------|
| `customRoles` | boolean | Can create custom RBAC roles | `role` |
| `extraUnits` | boolean | More than base units per collection | `unit-collection` |
| `batchTracking` | boolean | Batch/lot tracking for items | `batch`, `item` |
| `inventoryReservations` | boolean | Reserve stock for orders | `inventory-reservation` |
| `multiCurrency` | boolean | Multi-currency transactions | `accounting`, `item` |
| `accounting` | enum | `none`, `basic`, `full` | `accounting` |
| `salesOrders` | boolean | Sales order management | `sales_order` (future) |
| `purchaseOrders` | boolean | Purchase order management | `purchase_order` (future) |
| `invoicing` | boolean | Invoice generation | `invoice` (future) |
| `apiAccess` | boolean | REST API access for integrations | `auth` |
| `customBranding` | boolean | White-label organization branding | `organization` |
| `sso` | boolean | SAML/OIDC single sign-on | `auth` |
| `advancedReports` | boolean | Custom reports and dashboards | `report` (future) |

---

## 4. Limit Key Registry

| Key | Description | Unit | Modules enforced |
|-----|-------------|------|-----------------|
| `maxOrganizations` | Orgs a user can own | count | `organization` |
| `maxMembers` | Members per organization | count | `organization-user`, `organization-invitation` |
| `maxItems` | Items per organization | count | `item` |
| `maxWarehouses` | Physical warehouses per org | count | `warehouse` |
| `maxLocationsPerWarehouse` | Locations per warehouse | count | `warehouse-location` |
| `maxCustomers` | Customers per org | count | `party` (role=CUSTOMER) |
| `maxVendors` | Vendors per org | count | `party` (role=VENDOR) |
| `maxUnitCollections` | Unit collections per org | count | `unit-collection` |
| `maxAdjustmentsPerMonth` | Inventory adjustments per calendar month | count/mo | `inventory-adjustment` |
| `auditLogRetentionDays` | Days to retain audit log | days | `activity-log` |

---

## 5. Business Rules

### 5.1 Plan Hierarchy
- Plans have a `tier` integer that defines their rank: free(0) < starter(1) < pro(2) < business(3) < enterprise(4).
- Upgrades go to a higher tier; downgrades go to a lower tier.
- Enterprise plans may have custom limits overriding the defaults.

### 5.2 Plan Immutability
- Once a plan has active subscriptions, its feature/limit definitions are **versioned** — changes create a new plan version; existing subscriptions stay on their version until renewal.
- Price changes only affect new subscriptions; existing subscribers keep their price until they change plans.

### 5.3 Seed Data
- Plans, features, limits, and prices are **seeded** (like system roles), not created through the UI.
- An admin-only API exists for plan management (create, update, deactivate), protected by a platform admin role.

### 5.4 Free Plan
- Every new organization starts on the Free plan with no trial period.
- The Free plan cannot be deactivated.
- Free plan limits are enforced immediately.

---

## 6. API Contract

### 6.1 Public Endpoints (no auth required)

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| PLAN-LIST-PUBLIC | GET | `/plans` | List all public, active plans with prices |
| PLAN-GET-PUBLIC | GET | `/plans/:code` | Get a single plan's details, features, limits, prices |
| PLAN-COMPARE | GET | `/plans/compare` | Feature matrix comparison of all public plans |

### 6.2 Organization Endpoints (authenticated, org-scoped)

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| PLAN-CURRENT | GET | `/organizations/:orgId/plan` | Get the org's current plan, features, limits, usage |
| PLAN-ADDONS | GET | `/organizations/:orgId/plan/addons` | List available add-ons for the org's current plan |

### 6.3 Admin Endpoints (platform admin only)

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| PLAN-ADMIN-LIST | GET | `/admin/plans` | List all plans (including inactive/private) |
| PLAN-ADMIN-CREATE | POST | `/admin/plans` | Create a new plan |
| PLAN-ADMIN-UPDATE | PATCH | `/admin/plans/:id` | Update plan metadata |
| PLAN-ADMIN-FEATURES | PUT | `/admin/plans/:id/features` | Set feature flags for a plan |
| PLAN-ADMIN-LIMITS | PUT | `/admin/plans/:id/limits` | Set limit values for a plan |
| PLAN-ADMIN-PRICES | POST | `/admin/plans/:id/prices` | Add a new price to a plan |
| PLAN-ADMIN-ADDON-CREATE | POST | `/admin/addons` | Create an add-on |
| PLAN-ADMIN-ADDON-UPDATE | PATCH | `/admin/addons/:id` | Update an add-on |

---

## 7. Response Schemas

### 7.1 Public Plan DTO

```typescript
PlanDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  tier: z.number().int(),
  trialDays: z.number().int(),
  features: z.array(z.object({
    key: z.string(),
    enabled: z.boolean(),
    metadata: z.record(z.unknown()).nullable(),
  })),
  limits: z.array(z.object({
    key: z.string(),
    value: z.number().int(),   // -1 = unlimited
  })),
  prices: z.array(z.object({
    currency: z.string(),
    interval: z.enum(["monthly", "yearly", "one_time"]),
    amount: z.string(),        // decimal string for precision
  })),
})
```

### 7.2 Current Plan DTO (org-scoped, includes usage)

```typescript
CurrentPlanDtoSchema = z.object({
  plan: PlanDtoSchema,
  addons: z.array(AddonDtoSchema),
  usage: z.array(z.object({
    limitKey: z.string(),
    limit: z.number().int(),   // effective limit (plan + addons)
    used: z.number().int(),    // current usage count
  })),
  subscription: z.object({
    status: SubscriptionStatusSchema,
    currentPeriodEnd: z.string().datetime(),
    cancelAtPeriodEnd: z.boolean(),
  }).nullable(),
})
```

---

## 8. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `PLAN_NOT_FOUND` | 404 | Plan does not exist or is inactive |
| `PLAN_CODE_TAKEN` | 409 | A plan with this code already exists |
| `PLAN_CANNOT_DEACTIVATE` | 409 | Plan has active subscriptions |
| `PLAN_ADMIN_REQUIRED` | 403 | Caller is not a platform admin |

---

## 9. Frontend Requirements

### 9.1 Public Pricing Page (`/pricing`)
- Display all public plans in a comparison grid.
- Highlight the recommended plan (Pro).
- Toggle between monthly and yearly pricing.
- Show savings percentage for yearly billing.
- "Start free" CTA for the Free plan; "Start trial" for paid plans (if `trialDays > 0`).
- Add-ons section below the main grid.
- Responsive: cards on mobile, table on desktop.

### 9.2 Current Plan Page (`/:org/settings/plan`)
- Show the organization's current plan with feature highlights.
- Usage bars for each limit (e.g., "23 / 50 items used").
- Warning state when usage > 80% of a limit.
- "Upgrade" button when on Free/Starter; "Manage subscription" for paid plans.
- Active add-ons list with "Remove" action.
- Available add-ons with "Add" action.

### 9.3 Upgrade/Downgrade Flow
- Plan selection step (highlight current plan, show price difference).
- Proration preview before confirming.
- Payment method selection / entry (via Stripe Elements).
- Confirmation step with summary.
- Success/error result screen.

---

## 10. Permissions

| Operation | Required Permission | Notes |
|-----------|-------------------|-------|
| View public plans | None | Public endpoint |
| View current plan | `read:organization` | Any org member |
| Change plan | Owner only | `type = 'owner'` on `organization_users` |
| Manage add-ons | Owner only | Same |
| Admin plan management | Platform admin | Separate admin auth |

---

## 11. Cross-Module Dependencies

| Dependency | Direction | What |
|------------|-----------|------|
| Subscription | Plan → Subscription | Subscription references the plan |
| Feature Gate | Plan → Feature Gate | Feature Gate reads plan features/limits |
| Organization | Plan → Organization | Current plan is scoped to an org via subscription |
| Billing | Plan → Billing | Prices feed invoice line items |

---

## 12. Seed Data

Plans, features, limits, and prices are defined in a seed file and applied via `pnpm seed:plans`. The seed is **idempotent** — running it again updates existing records without duplicating them.

```
packages/db/src/seed/plans.ts
```

Seed order:
1. Plans (upsert by `code`)
2. Plan features (upsert by `planId` + `featureKey`)
3. Plan limits (upsert by `planId` + `limitKey`)
4. Plan prices (upsert by `planId` + `currency` + `interval`)
5. Add-ons (upsert by `code`)
6. Add-on prices (upsert by `addonId` + `currency` + `interval`)
