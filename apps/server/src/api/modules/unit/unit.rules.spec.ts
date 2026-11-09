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
} from "./unit.rules.js"

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
    expect(isValidFactor("0")).toBe(false)
    expect(isValidFactor("0.0000000000001")).toBe(false)
    expect(isValidFactor("-2")).toBe(false)
  })
})

describe("checkCollectionDraft", () => {
  const found = [u("m"), u("cm"), u("kg", "weight"), u("old", "length", { isActive: false })]

  it("accepts a base unit with same-type extras and returns the base", () => {
    const res = checkCollectionDraft("m", [{ unitId: "cm", conversionFactor: "0.01" }], found)
    expect(res).toMatchObject({ ok: true, value: { id: "m" } })
  })
  it("rejects a missing or inactive base unit", () => {
    expect(checkCollectionDraft("zz", [], found)).toMatchObject({ ok: false, violation: { error: "UNIT_NOT_FOUND" } })
    expect(checkCollectionDraft("old", [], found)).toMatchObject({ ok: false, violation: { error: "UNIT_NOT_FOUND" } })
  })
  it("rejects units of another type", () => {
    const res = checkCollectionDraft("m", [{ unitId: "kg", conversionFactor: "1" }], found)
    expect(res).toMatchObject({ ok: false, violation: { error: "UNIT_TYPE_MISMATCH" } })
  })
  it("rejects duplicates, including the base unit listed again", () => {
    const dup = checkCollectionDraft(
      "m",
      [{ unitId: "cm", conversionFactor: "0.01" }, { unitId: "cm", conversionFactor: "0.02" }],
      found
    )
    const base = checkCollectionDraft("m", [{ unitId: "m", conversionFactor: "1" }], found)
    expect(dup).toMatchObject({ ok: false, violation: { error: "UNIT_DUPLICATE_IN_COLLECTION" } })
    expect(base).toMatchObject({ ok: false, violation: { error: "UNIT_DUPLICATE_IN_COLLECTION" } })
  })
  it("rejects bad factors and oversized collections", () => {
    expect(checkCollectionDraft("m", [{ unitId: "cm", conversionFactor: "0" }], found)).toMatchObject({
      ok: false,
      violation: { error: "UNIT_INVALID_CONVERSION_FACTOR" },
    })
    expect(checkCollectionDraft("m", [{ unitId: "cm", conversionFactor: "1" }], found, 1)).toMatchObject({
      ok: false,
      violation: { error: "UNIT_COLLECTION_TOO_MANY_UNITS" },
    })
  })
})

describe("buildCollectionRows", () => {
  it("puts the base unit first at factor 1 and normalizes the rest", () => {
    expect(buildCollectionRows("m", [{ unitId: "cm", conversionFactor: "0.010" }])).toEqual([
      { unitId: "m", conversionFactor: "1" },
      { unitId: "cm", conversionFactor: "0.01" },
    ])
  })
})

describe("diffCollectionUnits", () => {
  const current = [
    { unitId: "m", conversionFactor: "1.000000000000" },
    { unitId: "cm", conversionFactor: "0.010000000000" },
    { unitId: "mm", conversionFactor: "0.001000000000" },
  ]
  it("adds, updates and removes only what differs; never touches the base row", () => {
    const diff = diffCollectionUnits(
      current,
      [
        { unitId: "cm", conversionFactor: "0.02" },
        { unitId: "in", conversionFactor: "0.0254" },
      ],
      "m"
    )
    expect(diff).toEqual({
      add: [{ unitId: "in", conversionFactor: "0.0254" }],
      update: [{ unitId: "cm", conversionFactor: "0.02" }],
      remove: ["mm"],
    })
  })
  it("a stored 0.010000000000 equals a submitted 0.01 (no write)", () => {
    const diff = diffCollectionUnits(
      current,
      [{ unitId: "cm", conversionFactor: "0.01" }, { unitId: "mm", conversionFactor: "0.001" }],
      "m"
    )
    expect(diffHasChanges(diff)).toBe(false)
  })
})

describe("names and deletion", () => {
  it("generates a name unless one is given", () => {
    expect(collectionName(undefined, { name: "Meter", symbol: "m" })).toBe("Meter (m)")
    expect(collectionName("  ", { name: "Meter", symbol: "m" })).toBe("Meter (m)")
    expect(collectionName(" Sand ", { name: "Meter", symbol: "m" })).toBe("Sand")
  })
  it("a collection used by items cannot be deleted", () => {
    expect(checkCollectionDeletable(0)).toBeNull()
    expect(checkCollectionDeletable(2)).toMatchObject({ error: "UNIT_COLLECTION_IN_USE" })
  })
})
