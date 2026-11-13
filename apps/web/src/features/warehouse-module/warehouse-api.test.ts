import { describe, expect, it } from "vitest"
import { normalizeWarehouse, normalizeWarehouseListItem } from "./warehouse-api"

describe("warehouse-api normalization", () => {
  it("turns missing optional fields into null", () => {
    const w = normalizeWarehouse({
      id: "w1", code: "WH-01", name: "Main", type: "physical",
      isDefault: true, isSystem: false, isActive: true,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    })
    expect([w.description, w.addressLine, w.city, w.region, w.postalCode, w.countryCode]).toEqual([null, null, null, null, null, null])
  })
  it("keeps provided values", () => {
    const w = normalizeWarehouse({
      id: "w1", code: "WH-01", name: "Main", type: "virtual", description: "d", city: "Cairo",
      isDefault: false, isSystem: true, isActive: true,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(w).toMatchObject({ description: "d", city: "Cairo", type: "virtual", isSystem: true })
  })
  it("normalizes list items", () => {
    expect(normalizeWarehouseListItem({ id: "w1", code: "A", name: "A", type: "physical", isDefault: false, isSystem: false, isActive: true, updatedAt: "x" }).type).toBe("physical")
  })
})
