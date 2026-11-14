import { describe, expect, it } from "vitest"

import { normalizeItem, statusToIsActive } from "./item-api"

const raw = {
  id: "i1",
  orgId: "o1",
  name: "Royal Cement",
  categoryId: "c1",
  categoryName: "Cement",
  baseUnit: {
    id: "u1",
    orgId: null,
    name: "Kilogram",
    symbol: "kg",
    type: "weight" as const,
    isActive: true,
    isSystem: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  unitCollectionId: "uc1",
  canAssembled: false,
  isReturnable: true,
  isInventoryTracked: true,
  isBatchTracked: false,
  isExpiryTracked: false,
  expirySettings: null,
  inventoryValuationMethod: "fifo" as const,
  isActive: true,
  allowNegativeStock: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("item-api normalization", () => {
  it("fills missing optional fields with null", () => {
    const item = normalizeItem(raw)
    expect(item.description).toBeNull()
    expect(item.reorderPoint).toBeNull()
    expect(item.baseUnit.symbol).toBe("kg")
  })

  it("keeps given values", () => {
    expect(
      normalizeItem({ ...raw, description: "Bag", reorderPoint: "20.000000" })
    ).toMatchObject({
      description: "Bag",
      reorderPoint: "20.000000",
    })
  })

  it("maps the status tab to the isActive query value", () => {
    expect(statusToIsActive("all")).toBeUndefined()
    expect(statusToIsActive("active")).toBe("true")
    expect(statusToIsActive("inactive")).toBe("false")
  })
})
