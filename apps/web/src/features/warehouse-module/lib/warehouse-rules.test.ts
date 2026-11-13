import { describe, expect, it } from "vitest"
import { formatAddress, getWarehouseActionAvailability, type WarehouseAbilities } from "./warehouse-rules"

const all: WarehouseAbilities = { canCreate: true, canUpdate: true, canDeactivate: true, canDelete: true }
const none: WarehouseAbilities = { canCreate: false, canUpdate: false, canDeactivate: false, canDelete: false }
const base = { type: "physical" as const, isDefault: false, isSystem: false, isActive: true }

describe("getWarehouseActionAvailability", () => {
  it("offers everything sensible for a normal active physical warehouse", () => {
    expect(getWarehouseActionAvailability(base, all)).toEqual({
      canEdit: true, canSetDefault: true, canDeactivate: true, canReactivate: false, canDelete: true,
      deactivateDisabled: false, deleteDisabled: false,
    })
  })
  it("offers nothing to a user without permissions", () => {
    const a = getWarehouseActionAvailability(base, none)
    expect([a.canEdit, a.canSetDefault, a.canDeactivate, a.canReactivate, a.canDelete]).toEqual([false, false, false, false, false])
  })
  it("treats system warehouses as read-only", () => {
    const a = getWarehouseActionAvailability({ ...base, isSystem: true, type: "virtual" }, all)
    expect([a.canEdit, a.canSetDefault, a.canDeactivate, a.canReactivate, a.canDelete]).toEqual([false, false, false, false, false])
  })
  it("keeps the default visible but disabled for retire and delete", () => {
    const a = getWarehouseActionAvailability({ ...base, isDefault: true }, all)
    expect(a).toMatchObject({ canDeactivate: true, deactivateDisabled: true, canDelete: true, deleteDisabled: true, canSetDefault: false })
  })
  it("only lets active physical warehouses become the default", () => {
    expect(getWarehouseActionAvailability({ ...base, type: "virtual" }, all).canSetDefault).toBe(false)
    expect(getWarehouseActionAvailability({ ...base, isActive: false }, all).canSetDefault).toBe(false)
  })
  it("offers reactivate, not deactivate, for an inactive warehouse", () => {
    const a = getWarehouseActionAvailability({ ...base, isActive: false }, all)
    expect(a).toMatchObject({ canReactivate: true, canDeactivate: false })
  })
})

describe("formatAddress", () => {
  it("joins the filled parts only", () => {
    expect(formatAddress({ addressLine: "1 Nile St", city: "Cairo", region: null, postalCode: " ", countryCode: "EG" })).toBe("1 Nile St, Cairo, EG")
    expect(formatAddress({ addressLine: null, city: null, region: null, postalCode: null, countryCode: null })).toBe("")
  })
})
