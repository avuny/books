import { describe, expect, it } from "vitest"
import {
  buildCollectionRows,
  checkCollectionDeletable,
  checkCollectionDraft,
  collectionName,
  diffCollectionUnits,
  diffHasChanges,
  isValidFactor,
  normalizeDecimal,
  type UnitRef,
} from "./unit-collection.rules.js"

const u = (id: string, type: UnitRef["type"] = "length", o: Partial<UnitRef> = {}): UnitRef => ({
  id,
  name: id.toUpperCase(),
  symbol: id,
  type,
  isActive: true,
  ...o,
})

describe("normalizeDecimal / isValidFactor", () => {
  it("makes stored and submitted numbers comparable", () => {
    expect(normalizeDecimal("0.010000000000")).toBe("0.01")
    expect(normalizeDecimal("1.000000000000")).toBe("1")
    expect(normalizeDecimal("007.50")).toBe("7.5")
    expect(normalizeDecimal("0")).toBe("0")
  })
  it("factors must fit numeric(24, 12) and be positive", () => {
    expect(isValidFactor("0.01")).toBe(true)
    expect(isValidFactor("1")).toBe(true)
    expect(isValidFactor("0")).toBe(false)
    expect(isValidFactor("-1")).toBe(false)
    expect(isValidFactor("abc")).toBe(false)
  })
})

describe("checkCollectionDraft", () => {
  it("passes when the base unit is active and all extra units share its type", () => {
    const res = checkCollectionDraft(
      "m",
      [
        { unitId: "cm", conversionFactor: "0.01" },
        { unitId: "mm", conversionFactor: "0.001" },
      ],
      [u("m"), u("cm"), u("mm")]
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.id).toBe("m")
  })

  it("fails when the base unit does not exist or is inactive", () => {
    expect(checkCollectionDraft("m", [], []).ok).toBe(false)
    expect(checkCollectionDraft("m", [], [u("m", "length", { isActive: false })]).ok).toBe(false)
  })

  it("fails when an extra unit measures something else", () => {
    const res = checkCollectionDraft("m", [{ unitId: "kg", conversionFactor: "1" }], [u("m"), u("kg", "weight")])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation.error).toBe("UNIT_TYPE_MISMATCH")
  })

  it("fails when a unit appears twice or repeats the base unit", () => {
    const dupe = checkCollectionDraft(
      "m",
      [
        { unitId: "cm", conversionFactor: "0.01" },
        { unitId: "cm", conversionFactor: "0.01" },
      ],
      [u("m"), u("cm")]
    )
    expect(dupe.ok).toBe(false)
    if (!dupe.ok) expect(dupe.violation.error).toBe("UNIT_DUPLICATE_IN_COLLECTION")

    const self = checkCollectionDraft("m", [{ unitId: "m", conversionFactor: "1" }], [u("m")])
    expect(self.ok).toBe(false)
    if (!self.ok) expect(self.violation.error).toBe("UNIT_DUPLICATE_IN_COLLECTION")
  })

  it("fails on an invalid factor", () => {
    const res = checkCollectionDraft("m", [{ unitId: "cm", conversionFactor: "0" }], [u("m"), u("cm")])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation.error).toBe("UNIT_INVALID_CONVERSION_FACTOR")
  })

  it("enforces maxUnits", () => {
    const res = checkCollectionDraft("m", [{ unitId: "cm", conversionFactor: "0.01" }], [u("m"), u("cm")], 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.violation.error).toBe("UNIT_COLLECTION_TOO_MANY_UNITS")
  })
})

describe("diffCollectionUnits", () => {
  it("never touches the base unit row", () => {
    const diff = diffCollectionUnits(
      [
        { unitId: "m", conversionFactor: "1" },
        { unitId: "cm", conversionFactor: "0.010000000000" },
      ],
      [{ unitId: "cm", conversionFactor: "0.01" }],
      "m"
    )
    expect(diff).toEqual({ add: [], update: [], remove: [] })
    expect(diffHasChanges(diff)).toBe(false)
  })

  it("computes adds, updates and removes together", () => {
    const diff = diffCollectionUnits(
      [
        { unitId: "m", conversionFactor: "1" },
        { unitId: "cm", conversionFactor: "0.01" },
        { unitId: "mm", conversionFactor: "0.001" },
      ],
      [
        { unitId: "cm", conversionFactor: "0.02" },
        { unitId: "km", conversionFactor: "1000" },
      ],
      "m"
    )
    expect(diff.add).toEqual([{ unitId: "km", conversionFactor: "1000" }])
    expect(diff.update).toEqual([{ unitId: "cm", conversionFactor: "0.02" }])
    expect(diff.remove).toEqual(["mm"])
    expect(diffHasChanges(diff)).toBe(true)
  })
})

describe("buildCollectionRows / collectionName / checkCollectionDeletable", () => {
  it("buildCollectionRows puts the base unit at factor 1", () => {
    const rows = buildCollectionRows("m", [{ unitId: "cm", conversionFactor: "0.01" }])
    expect(rows).toEqual([
      { unitId: "m", conversionFactor: "1" },
      { unitId: "cm", conversionFactor: "0.01" },
    ])
  })

  it("collectionName falls back to <name> (<symbol>)", () => {
    expect(collectionName(undefined, { name: "Meter", symbol: "m" })).toBe("Meter (m)")
    expect(collectionName("  Custom  ", { name: "Meter", symbol: "m" })).toBe("Custom")
  })

  it("checkCollectionDeletable blocks deletion if itemCount > 0", () => {
    expect(checkCollectionDeletable(0)).toBeNull()
    expect(checkCollectionDeletable(3)?.error).toBe("UNIT_COLLECTION_IN_USE")
  })
})
