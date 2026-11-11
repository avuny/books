import { describe, expect, it } from "vitest"

import { normalizeUnitCollection, unitLabel } from "./unit-collection-api"

describe("unit-collection-api normalization", () => {
  it("keeps the units of a collection with their factors and base flag", () => {
    const collection = normalizeUnitCollection({
      id: "c1",
      orgId: "o1",
      name: "Meter (m)",
      baseUnitId: "u-m",
      units: [
        {
          id: "u-m",
          orgId: null,
          name: "Meter",
          symbol: "m",
          type: "length",
          isActive: true,
          isSystem: true,
          conversionFactor: "1.000000000000",
          isBase: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "u-cm",
          orgId: null,
          name: "Centimeter",
          symbol: "cm",
          type: "length",
          isActive: true,
          isSystem: true,
          conversionFactor: "0.010000000000",
          isBase: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      itemCount: 3,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(collection.units.map((u) => u.isBase)).toEqual([true, false])
    expect(collection.itemCount).toBe(3)
  })

  it("labels a unit like the picker does", () => {
    expect(unitLabel({ name: "Meter", symbol: "m" })).toBe("Meter (m)")
  })
})
