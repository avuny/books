import { describe, expect, it } from "vitest"

import { EntitlementErrorCode } from "./errors.js"
import {
  EntitlementKeySchema,
  EntitlementSnapshotSchema,
  LimitValueSchema,
  ModuleSwitchSchema,
  PlanEntitlementSchema,
  PlanSchema,
  entitlementKindOf,
  limitEntitlementKey,
  moduleEntitlementKey,
} from "./index.js"

/**
 * S2-01 done-when: contracts build and export. These tests pin the shapes
 * the resolver (S2-03) and the seed (S2-04) rely on.
 */

describe("entitlement keys (SPEC 2.1)", () => {
  it("accepts module keys for real product modules only", () => {
    expect(EntitlementKeySchema.safeParse("module.purchasing").success).toBe(true)
    expect(EntitlementKeySchema.safeParse("module.not_a_module").success).toBe(false)
  })

  it("accepts feature and limit keys with dotted snake_case names", () => {
    expect(EntitlementKeySchema.safeParse("feature.inventory.batch_tracking").success).toBe(true)
    expect(EntitlementKeySchema.safeParse("limit.items").success).toBe(true)
    expect(EntitlementKeySchema.safeParse("limit.Bad-Name").success).toBe(false)
    expect(EntitlementKeySchema.safeParse("other.items").success).toBe(false)
  })

  it("derives the kind from the key prefix", () => {
    expect(entitlementKindOf(moduleEntitlementKey("inventory"))).toBe("module")
    expect(entitlementKindOf("feature.custom_roles")).toBe("feature")
    expect(entitlementKindOf(limitEntitlementKey("items"))).toBe("limit")
  })
})

describe("plan entitlements", () => {
  const base = {
    id: "3b6c6f8e-9c36-4f62-9b0a-9c5d2d2f0a11",
    planId: "7a1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f",
  }

  it("requires boolean values for module rows", () => {
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "module.purchasing", value: true }).success
    ).toBe(true)
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "module.purchasing", value: 1 }).success
    ).toBe(false)
  })

  it("requires integer values with -1 floor for limit rows", () => {
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "limit.items", value: -1 }).success
    ).toBe(true)
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "limit.items", value: -2 }).success
    ).toBe(false)
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "limit.items", value: 1.5 }).success
    ).toBe(false)
  })

  it("allows boolean and enum-string feature rows", () => {
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "feature.custom_roles", value: true }).success
    ).toBe(true)
    expect(
      PlanEntitlementSchema.safeParse({ ...base, key: "feature.accounting_level", value: "basic" }).success
    ).toBe(true)
  })
})

describe("plans, switches and snapshots", () => {
  it("accepts a plan row (SPEC 5)", () => {
    const plan = {
      id: "3b6c6f8e-9c36-4f62-9b0a-9c5d2d2f0a11",
      code: "pro",
      name: "Pro",
      tier: 1,
      isPublic: true,
      isPurchasable: true,
      trialDays: 14,
      sort: 1,
    }
    expect(PlanSchema.safeParse(plan).success).toBe(true)
    expect(PlanSchema.safeParse({ ...plan, code: "Pro Plan!" }).success).toBe(false)
  })

  it("switches reference product module keys only", () => {
    expect(ModuleSwitchSchema.safeParse({ moduleKey: "inventory", enabled: false }).success).toBe(true)
    expect(ModuleSwitchSchema.safeParse({ moduleKey: "purchase_order", enabled: false }).success).toBe(false)
  })

  it("accepts a resolved snapshot (SPEC 3.2, 3.3, R5)", () => {
    const snapshot = {
      orgId: "3b6c6f8e-9c36-4f62-9b0a-9c5d2d2f0a11",
      version: 3,
      accessState: "full",
      modules: {
        core: { state: "enabled", entitled: true, switchedOn: true },
        inventory: { state: "enabled", entitled: true, switchedOn: true },
        inventory_advanced: { state: "off", entitled: true, switchedOn: false },
        inventory_costing: { state: "locked", entitled: false, switchedOn: false },
        purchasing: { state: "locked", entitled: false, switchedOn: false },
        sales: { state: "winding_down", entitled: false, switchedOn: true },
        accounting: { state: "blocked_by_dependency", entitled: true, switchedOn: true },
        assembly: { state: "locked", entitled: false, switchedOn: false },
      },
      features: { "feature.custom_roles": true },
      limits: { "limit.items": 500 },
      computedAt: "2026-11-28T02:00:00.000Z",
    }
    expect(EntitlementSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(
      EntitlementSnapshotSchema.safeParse({
        ...snapshot,
        accessState: "deleted",
      }).success
    ).toBe(false)
  })

  it("limits reject values below the unlimited sentinel", () => {
    expect(LimitValueSchema.safeParse(-1).success).toBe(true)
    expect(LimitValueSchema.safeParse(-2).success).toBe(false)
  })
})

describe("error codes (SPEC 6.2)", () => {
  it("exposes the eight spec codes verbatim", () => {
    expect(Object.values(EntitlementErrorCode).sort()).toEqual(
      [
        "ENTITLEMENT_KEY_UNKNOWN",
        "FEATURE_NOT_IN_PLAN",
        "LIMIT_REACHED",
        "MODULE_DEPENDENCY_LOCKED",
        "MODULE_NOT_ENABLED",
        "MODULE_REQUIRED_BY",
        "PLAN_NOT_PURCHASABLE",
        "SUBSCRIPTION_ACCESS_RESTRICTED",
      ].sort()
    )
  })
})
