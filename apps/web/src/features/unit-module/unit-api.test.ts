import { describe, expect, it } from "vitest"

import { normalizeUnitCollection, unitLabel } from "./unit-api"

describe("unit-api normalization", () => {
  it("keeps the units of a collection with their factors and base flag", () => {
    const collection = normalizeUnitCollection({
      id: "c1",
      orgId: "o1",
      name: "Meter (m)",
      baseUnitId: "u-m",
      units: [
        { id: "u-m", name: "Meter", symbol: "m", type: "length", conversionFactor: "1.000000000000", isBase: true },
        { id: "u-cm", name: "Centimeter", symbol: "cm", type: "length", conversionFactor: "0.010000000000", isBase: false },
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
