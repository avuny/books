import { describe, expect, it } from "vitest"
import {
  getAllowedLocationTypes,
  getLocationActionAvailability,
  isDefaultCodePrefix,
  isLocationReadOnly,
  suggestBulkLevelType,
  suggestedCodePrefix,
  type LocationAbilities,
} from "./location-rules"

const all: LocationAbilities = { canCreate: true, canUpdate: true, canDeactivate: true, canDelete: true, canMove: true, canBlock: true, canChangeBarcode: true }
const none: LocationAbilities = { canCreate: false, canUpdate: false, canDeactivate: false, canDelete: false, canMove: false, canBlock: false, canChangeBarcode: false }
const container = { isStockable: false, isActive: true, isBlocked: false }

describe("getLocationActionAvailability", () => {
  it("offers add-child only for active containers", () => {
    expect(getLocationActionAvailability(container, all, false).canAddChild).toBe(true)
    expect(getLocationActionAvailability({ ...container, isStockable: true }, all, false).canAddChild).toBe(false)
    expect(getLocationActionAvailability({ ...container, isActive: false }, all, false).canAddChild).toBe(false)
  })
  it("swaps block and unblock with the blocked state", () => {
    expect(getLocationActionAvailability(container, all, false)).toMatchObject({ canBlock: true, canUnblock: false })
    expect(getLocationActionAvailability({ ...container, isBlocked: true }, all, false)).toMatchObject({ canBlock: false, canUnblock: true })
  })
  it("swaps deactivate and reactivate with the active state", () => {
    expect(getLocationActionAvailability({ ...container, isActive: false }, all, false)).toMatchObject({ canDeactivate: false, canReactivate: true })
  })
  it("offers nothing without permissions or in a read-only warehouse", () => {
    const off = (a: ReturnType<typeof getLocationActionAvailability>) => Object.values(a).every((v) => v === false)
    expect(off(getLocationActionAvailability(container, none, false))).toBe(true)
    expect(off(getLocationActionAvailability(container, all, true))).toBe(true)
  })
})

describe("isLocationReadOnly", () => {
  it("is read-only for system, inactive or unknown warehouses", () => {
    expect(isLocationReadOnly({ isSystem: true, isActive: true })).toBe(true)
    expect(isLocationReadOnly({ isSystem: false, isActive: false })).toBe(true)
    expect(isLocationReadOnly(null)).toBe(true)
    expect(isLocationReadOnly({ isSystem: false, isActive: true })).toBe(false)
  })
})

describe("getAllowedLocationTypes", () => {
  it("allows every physical type at the top level of a physical warehouse, except virtual_bin", () => {
    const types = getAllowedLocationTypes(null, "physical")
    expect(types).toContain("zone")
    expect(types).toContain("bin")
    expect(types).not.toContain("virtual_bin")
  })
  it("only allows lower ranks under a parent", () => {
    expect(getAllowedLocationTypes("rack", "physical")).toEqual(["bay", "level", "shelf", "bin"])
    expect(getAllowedLocationTypes("bin", "physical")).toEqual([])
  })
  it("limits virtual warehouses to virtual_bin and area", () => {
    expect(getAllowedLocationTypes(null, "virtual")).toEqual(["area", "virtual_bin"])
  })
})

describe("suggestions", () => {
  it("suggests code prefixes", () => {
    expect(suggestedCodePrefix("bin")).toBe("BIN-")
    expect(suggestedCodePrefix("aisle")).toBe("A-")
  })
  it("suggests the next level type below the previous one", () => {
    expect(suggestBulkLevelType(null, "physical")).toBe("zone")
    expect(suggestBulkLevelType("zone", "physical")).toBe("aisle")
    expect(suggestBulkLevelType("rack", "physical")).toBe("bay")
    expect(suggestBulkLevelType("bin", "physical")).toBe("bin")
    expect(suggestBulkLevelType("aisle", "virtual")).toBe("virtual_bin")
  })
})

describe("isDefaultCodePrefix", () => {
  it("recognizes untouched prefixes", () => {
    expect(isDefaultCodePrefix("")).toBe(true)
    expect(isDefaultCodePrefix("BIN-")).toBe(true)
    expect(isDefaultCodePrefix("MYBIN-")).toBe(false)
  })
})
