import { describe, expect, it } from "vitest"
import {
  autoCollectionName,
  changedLockedFields,
  checkDeletable,
  checkLock,
  checkTracking,
  effectiveTracking,
  pickUnitChange,
  requireBaseUnit,
  requireCategory,
  selectUnitSource,
} from "./item.rules.js"

const current = {
  isInventoryTracked: true,
  isBatchTracked: false,
  inventoryValuationMethod: "fifo" as const,
}

describe("tracking", () => {
  it("batch tracking requires inventory tracking", () => {
    expect(checkTracking({ isInventoryTracked: true, isBatchTracked: true })).toBeNull()
    expect(checkTracking({ isInventoryTracked: false, isBatchTracked: false })).toBeNull()
    expect(checkTracking({ isInventoryTracked: false, isBatchTracked: true })).toMatchObject({
      error: "ITEM_BATCH_REQUIRES_TRACKING",
    })
  })
  it("effectiveTracking applies a patch over the current flags", () => {
    expect(effectiveTracking({ isInventoryTracked: true, isBatchTracked: true }, { isInventoryTracked: false })).toEqual({
      isInventoryTracked: false,
      isBatchTracked: true,
    })
  })
})

describe("unit source", () => {
  it("create needs exactly one of base unit / collection", () => {
    expect(selectUnitSource({ baseUnitId: "u" })).toEqual({ kind: "base", baseUnitId: "u" })
    expect(selectUnitSource({ unitCollectionId: "c" })).toEqual({ kind: "collection", collectionId: "c" })
    expect(selectUnitSource({})).toBeNull()
    expect(selectUnitSource({ baseUnitId: "u", unitCollectionId: "c" })).toBeNull()
  })
  it("update only reports a change when the unit really differs", () => {
    const item = { baseUnitId: "u1", unitCollectionId: "c1" }
    expect(pickUnitChange(item, {})).toBeNull()
    expect(pickUnitChange(item, { baseUnitId: "u1" })).toBeNull()
    expect(pickUnitChange(item, { unitCollectionId: "c1" })).toBeNull()
    expect(pickUnitChange(item, { baseUnitId: "u2" })).toEqual({ kind: "base", baseUnitId: "u2" })
    expect(pickUnitChange(item, { unitCollectionId: "c2" })).toEqual({ kind: "collection", collectionId: "c2" })
  })
})

describe("references", () => {
  it("category must exist and be active", () => {
    expect(requireCategory({ isActive: true })).toMatchObject({ ok: true })
    expect(requireCategory({ isActive: false })).toMatchObject({ ok: false, violation: { error: "ITEM_CATEGORY_INVALID" } })
    expect(requireCategory(null)).toMatchObject({ ok: false })
  })
  it("base unit must exist and be active", () => {
    expect(requireBaseUnit({ isActive: true })).toMatchObject({ ok: true })
    expect(requireBaseUnit(undefined)).toMatchObject({ ok: false, violation: { error: "ITEM_UNIT_INVALID" } })
  })
  it("names the automatic collection after its base unit", () => {
    expect(autoCollectionName({ name: "Meter", symbol: "m" })).toBe("Meter (m)")
  })
})

describe("locking after stock movements", () => {
  it("lists only the locked fields that actually change", () => {
    expect(changedLockedFields(current, { isInventoryTracked: true }, false)).toEqual([])
    expect(
      changedLockedFields(current, { isBatchTracked: true, inventoryValuationMethod: "weighted_average" }, true)
    ).toEqual(["unit", "isBatchTracked", "inventoryValuationMethod"])
  })
  it("a change is refused only when the item has movements", () => {
    expect(checkLock(["unit"], false)).toBeNull()
    expect(checkLock([], true)).toBeNull()
    expect(checkLock(["unit", "isBatchTracked"], true)).toMatchObject({ error: "ITEM_LOCKED_FIELD" })
  })
  it("items with history are not deletable", () => {
    expect(checkDeletable(false)).toBeNull()
    expect(checkDeletable(true)).toMatchObject({ error: "ITEM_HAS_HISTORY" })
  })
})
