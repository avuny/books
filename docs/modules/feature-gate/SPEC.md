# Feature Gate Module — Specification

> **Version**: 1.0 · 2026-11-25
> **Status**: Specification
> **Parent**: [SaaS Overview](../SAAS-OVERVIEW.md)

---

## 1. Purpose

The Feature Gate module is the **runtime enforcement layer** that connects plan definitions to every other module in the system. It replaces all the existing `DummyPlanFeatures` / `DummyUnitCollectionPlanFeatures` / hardcoded `OrganizationLimits` implementations with a **single, unified service** that answers two questions:

1. **Feature check**: "Does this organization's plan include feature X?"
2. **Limit check**: "Has this organization reached its limit for resource Y?"

It is consumed by both the **backend** (service layer enforcement) and the **frontend** (UI gating — hiding/disabling features, showing upgrade prompts).

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Feature Gate Service                    │
│                                                          │
│  hasFeature(orgId, featureKey) → boolean                 │
│  checkLimit(orgId, limitKey)   → { allowed, used, max }  │
│  getEffectivePlan(orgId)       → Plan + Addons + Limits  │
│  getUsage(orgId)               → Map<limitKey, number>   │
│                                                          │
│  ┌─────────────────┐  ┌──────────────────┐              │
│  │ Plan Features    │  │ Plan Limits      │              │
│  │ (from plan +     │  │ (from plan +     │              │
│  │  subscription)   │  │  subscription +  │              │
│  │                 │  │  addons)         │              │
│  └────────┬────────┘  └────────┬─────────┘              │
│           │                    │                         │
│  ┌────────┴────────────────────┴─────────┐              │
│  │            Cache Layer (5 min TTL)     │              │
│  └───────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
  ┌──────────────┐           ┌──────────────┐
  │   Backend    │           │   Frontend   │
  │   Services   │           │   Hooks &    │
  │  (item,      │           │   Components │
  │   warehouse, │           │  (PlanGate,  │
  │   role, …)   │           │   usePlan)   │
  └──────────────┘           └──────────────┘
```

---

## 3. Service Interface

### 3.1 Core API

```typescript
interface FeatureGateService {
  /**
   * Check if an organization has a boolean feature enabled.
   * Returns true if the org's plan (or add-ons) include the feature.
   * Returns true for all features if no subscription exists and free plan includes it.
   */
  hasFeature(orgId: string, featureKey: FeatureKey): Promise<boolean>

  /**
   * Check if an organization can create more of a resource.
   * Returns the limit info + whether the action is allowed.
   */
  checkLimit(orgId: string, limitKey: LimitKey): Promise<LimitCheckResult>

  /**
   * Get the full effective plan for an organization, including addon effects.
   * Used by the frontend to render the plan page and upgrade prompts.
   */
  getEffectivePlan(orgId: string): Promise<EffectivePlan>

  /**
   * Get current usage counts for all limits.
   * Queries each module's count (items, warehouses, members, etc.).
   */
  getUsage(orgId: string): Promise<Map<LimitKey, number>>

  /**
   * Invalidate the cached plan/features for an organization.
   * Called when a subscription changes.
   */
  invalidate(orgId: string): Promise<void>
}

interface LimitCheckResult {
  allowed: boolean    // true if usage < limit
  used: number        // current count
  limit: number       // effective limit (-1 = unlimited)
  remaining: number   // limit - used (Infinity if unlimited)
}

interface EffectivePlan {
  planCode: string
  planName: string
  tier: number
  features: Map<FeatureKey, { enabled: boolean; metadata?: unknown }>
  limits: Map<LimitKey, number>  // effective limits (plan + addons)
  addons: Array<{ code: string; name: string; quantity: number }>
}
```

### 3.2 Usage Counters

Each module provides a count function that the Feature Gate calls:

| Limit Key | Query | Module |
|-----------|-------|--------|
| `maxOrganizations` | `SELECT COUNT(*) FROM organization_users WHERE user_id = ? AND type = 'owner'` | organization |
| `maxMembers` | `SELECT COUNT(*) FROM organization_users WHERE org_id = ? AND deleted_at IS NULL` | organization-user |
| `maxItems` | `SELECT COUNT(*) FROM items WHERE org_id = ? AND deleted_at IS NULL` | item |
| `maxWarehouses` | `SELECT COUNT(*) FROM warehouses WHERE org_id = ? AND type = 'physical' AND deleted_at IS NULL` | warehouse |
| `maxLocationsPerWarehouse` | `SELECT COUNT(*) FROM warehouse_locations WHERE warehouse_id = ? AND deleted_at IS NULL` | warehouse-location |
| `maxCustomers` | `SELECT COUNT(*) FROM parties WHERE org_id = ? AND deleted_at IS NULL` + customer role | party |
| `maxVendors` | `SELECT COUNT(*) FROM parties WHERE org_id = ? AND deleted_at IS NULL` + vendor role | party |
| `maxUnitCollections` | `SELECT COUNT(*) FROM unit_collections WHERE org_id = ? AND deleted_at IS NULL` | unit-collection |
| `maxAdjustmentsPerMonth` | `SELECT COUNT(*) FROM inventory_adjustments WHERE org_id = ? AND created_at >= ?` | inventory-adjustment |

### 3.3 Caching Strategy

- **Cache key**: `feature-gate:{orgId}`
- **TTL**: 5 minutes (configurable).
- **Invalidation**: explicit `invalidate(orgId)` call when subscription changes (called by subscription service).
- **Cache content**: the full `EffectivePlan` including resolved addon contributions.
- **Usage counts are NOT cached** — always queried live (they change frequently).

---

## 4. Integration with Existing Modules

### 4.1 Replacing Dummy Implementations

| Module | Current Interface | Current Impl | New Impl |
|--------|-------------------|-------------|----------|
| `role` | `PlanFeatures.has(orgId, "customRoles")` | `DummyPlanFeatures` → `true` | `featureGate.hasFeature(orgId, "customRoles")` |
| `unit-collection` | `UnitCollectionPlanFeatures.has(orgId, "extraUnits")` | `DummyUnitCollectionPlanFeatures` → `true` | `featureGate.hasFeature(orgId, "extraUnits")` |
| `organization` | `OrganizationLimits.maxOwnedPerUser(userId)` | Hardcoded | `featureGate.checkLimit(userId, "maxOrganizations")` |

### 4.2 Adding Limit Checks to Existing Modules

These modules currently have **no limit enforcement** and need `checkLimit` calls added:

| Module | Service Method | Limit Key | Error Code to Add |
|--------|---------------|-----------|-------------------|
| `item` | `create()` | `maxItems` | `ITEM_LIMIT_REACHED` |
| `warehouse` | `create()` | `maxWarehouses` | `WAREHOUSE_LIMIT_REACHED` |
| `warehouse-location` | `create()`, `bulkCreate()` | `maxLocationsPerWarehouse` | `WAREHOUSE_LOCATION_LIMIT_REACHED` |
| `party` (customer) | `create()` | `maxCustomers` | `CUSTOMER_LIMIT_REACHED` |
| `party` (vendor) | `create()` | `maxVendors` | `VENDOR_LIMIT_REACHED` |
| `unit-collection` | `create()` | `maxUnitCollections` | `UNIT_COLLECTION_LIMIT_REACHED` |
| `organization-user` | `create()` / invitation accept | `maxMembers` | `MEMBER_LIMIT_REACHED` |
| `organization-invitation` | `create()` | `maxMembers` (count current + pending) | `MEMBER_LIMIT_REACHED` |
| `inventory-adjustment` | `create()` | `maxAdjustmentsPerMonth` | `ADJUSTMENT_MONTHLY_LIMIT_REACHED` |

### 4.3 Service Dependency Injection

Each module's `deps.ts` file will inject the Feature Gate service:

```typescript
// Before (role module):
import { DummyPlanFeatures } from "./testing.js"
// features: new DummyPlanFeatures(),

// After:
import { featureGateService } from "../feature-gate/deps.js"
// features: featureGateService,
```

The Feature Gate service **implements all the existing interfaces** (`PlanFeatures`, `UnitCollectionPlanFeatures`, `OrganizationLimits`) so it's a drop-in replacement.

---

## 5. API Contract

### 5.1 Organization-Scoped Endpoints

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| GATE-FEATURES | GET | `/organizations/:orgId/features` | Get all feature flags for the org |
| GATE-LIMITS | GET | `/organizations/:orgId/limits` | Get all limits with current usage |
| GATE-CHECK | GET | `/organizations/:orgId/features/:key` | Check a single feature or limit |

### 5.2 Response Schemas

```typescript
FeatureListResponseSchema = z.object({
  planCode: z.string(),
  planTier: z.number().int(),
  features: z.array(z.object({
    key: z.string(),
    enabled: z.boolean(),
    metadata: z.record(z.unknown()).nullable(),
  })),
})

LimitListResponseSchema = z.object({
  planCode: z.string(),
  limits: z.array(z.object({
    key: z.string(),
    limit: z.number().int(),   // -1 = unlimited
    used: z.number().int(),
    remaining: z.number().int(), // -1 = unlimited
    percentage: z.number(),       // 0-100 or -1 for unlimited
  })),
})
```

---

## 6. Frontend Integration

### 6.1 React Hooks

```typescript
/**
 * Hook to check if a feature is available on the current org's plan.
 * Returns { enabled, loading, planCode }.
 */
function usePlanFeature(featureKey: FeatureKey): {
  enabled: boolean
  loading: boolean
  planCode: string
}

/**
 * Hook to get limit information for a resource.
 * Returns { allowed, used, limit, remaining, percentage, loading }.
 */
function usePlanLimit(limitKey: LimitKey): {
  allowed: boolean
  used: number
  limit: number          // -1 = unlimited
  remaining: number
  percentage: number     // 0-100
  loading: boolean
}

/**
 * Hook to get the full plan context (for settings pages).
 */
function useCurrentPlan(): {
  plan: EffectivePlanDto
  loading: boolean
}
```

### 6.2 React Components

```tsx
/**
 * Conditionally renders children based on a feature flag.
 * Shows an upgrade prompt if the feature is not available.
 */
<PlanGate feature="customRoles" fallback={<UpgradePrompt feature="customRoles" />}>
  <CreateCustomRoleButton />
</PlanGate>

/**
 * Shows a usage bar for a limit.
 */
<LimitUsageBar limitKey="maxItems" />

/**
 * Shows a banner when a limit is approaching (>80%).
 */
<LimitWarningBanner limitKey="maxItems" threshold={80} />

/**
 * Wraps a "Create" button to check limits before allowing the action.
 * Disables the button and shows a tooltip when the limit is reached.
 */
<LimitGuard limitKey="maxItems">
  <CreateItemButton />
</LimitGuard>
```

### 6.3 Frontend Behavior Rules

1. **Feature not available**: The UI element is either **hidden** or replaced with an **upgrade prompt** (never shown as broken).
2. **Limit reached**: The "Create" button is **disabled** with a tooltip: "You've reached your plan limit of {limit} {resource}. Upgrade for more."
3. **Limit approaching (>80%)**: A subtle warning banner appears on the list page.
4. **Upgrade prompt**: Links to the plan page with the minimum plan that includes the feature pre-selected.
5. **Never rely on frontend gating alone**: The backend always enforces. Frontend gating is for UX only.

---

## 7. Error Response Pattern

When a feature or limit check fails in the backend, the service returns:

```typescript
fail({
  error: "ITEM_LIMIT_REACHED",        // module-specific error code
  msg: "You have reached the item limit for your plan",
  meta: {
    limitKey: "maxItems",
    used: 50,
    limit: 50,
    planCode: "free",
    upgradeUrl: "/settings/plan",       // frontend can use this
  },
})
```

The `meta` field lets the frontend display actionable information without an extra API call.

---

## 8. Contracts Package

### 8.1 Feature and Limit Key Types

```typescript
// packages/contracts/src/feature-gate/constants.ts

export const FEATURE_KEYS = [
  "customRoles",
  "extraUnits",
  "batchTracking",
  "inventoryReservations",
  "multiCurrency",
  "salesOrders",
  "purchaseOrders",
  "invoicing",
  "apiAccess",
  "customBranding",
  "sso",
  "advancedReports",
] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const LIMIT_KEYS = [
  "maxOrganizations",
  "maxMembers",
  "maxItems",
  "maxWarehouses",
  "maxLocationsPerWarehouse",
  "maxCustomers",
  "maxVendors",
  "maxUnitCollections",
  "maxAdjustmentsPerMonth",
  "auditLogRetentionDays",
] as const
export type LimitKey = (typeof LIMIT_KEYS)[number]
```

### 8.2 Error Codes (per module)

Each module that enforces a limit adds its own error code to its existing error codes file. The Feature Gate module itself has:

| Code | HTTP | Description |
|------|------|-------------|
| `FEATURE_NOT_AVAILABLE` | 403 | Feature is not included in the org's plan |
| `LIMIT_REACHED` | 403 | Generic limit reached (modules use specific codes) |
| `PLAN_DATA_UNAVAILABLE` | 500 | Could not load plan information (service error) |

---

## 9. Cross-Module Dependencies

| Module | Direction | What |
|--------|-----------|------|
| Plan | reads | Plan features, limits definitions |
| Subscription | reads | Org's active subscription to determine plan |
| Every existing module | consumed by | Each module's service calls `hasFeature` / `checkLimit` |
| Cache | uses | Caches effective plan per org |

---

## 10. Testing Strategy

### 10.1 Unit Tests
- `FeatureGateService` with mocked plan/subscription data.
- Each combination of plan tier × feature key.
- Limit checks with mocked usage counts.
- Addon effects on limits.
- Cache invalidation.

### 10.2 Integration Tests
- Real database, real plan seeds, real subscriptions.
- Create an org → free plan → verify limits enforced.
- Subscribe to Starter → verify new limits.
- Add an add-on → verify limit increased.
- Downgrade → verify limits reduced.

### 10.3 Module Integration
- Each module's existing tests are updated with a real `FeatureGateService` (instead of `Dummy*`).
- Tests that create resources verify limit enforcement.
- Tests for the "limit reached" error code.
