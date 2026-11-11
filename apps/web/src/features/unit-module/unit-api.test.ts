import { describe, expect, it } from "vitest"

import { normalizeUnit, unitLabel } from "./unit-api"

describe("unit-api normalization", () => {
  it("normalizes unit correctly", () => {
    const unit = normalizeUnit({
      id: "u-kg",
      orgId: null,
      name: "Kilogram",
      symbol: "kg",
      type: "weight",
      isActive: true,
      isSystem: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })

    expect(unit.id).toBe("u-kg")
    expect(unit.isSystem).toBe(true)
    expect(unit.orgId).toBeNull()
  })

  it("formats unitLabel correctly", () => {
    expect(unitLabel({ name: "Kilogram", symbol: "kg" })).toBe("Kilogram (kg)")
  })
})

