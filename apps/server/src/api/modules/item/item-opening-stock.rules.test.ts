import { describe, expect, it } from "vitest"
import { checkOpeningStock } from "./item-opening-stock.rules.js"

const line = (o: Record<string, unknown> = {}) => ({
  locationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  quantity: "5",
  ...o,
})
const base = { isInventoryTracked: true, isBatchTracked: true, isExpiryTracked: false }

describe("checkOpeningStock", () => {
  it("accepts an item with no opening stock", () => {
    expect(checkOpeningStock({ ...base, openingStock: undefined })).toBeNull()
  })

  it("needs an inventory-tracked item", () => {
    expect(
      checkOpeningStock({ isInventoryTracked: false, isBatchTracked: false, isExpiryTracked: false, openingStock: { lines: [line()] } })
    ).toMatchObject({ error: "ITEM_OPENING_STOCK_NOT_TRACKED" })
  })

  it("accepts opening stock with quantity and location for non-expiry item", () => {
    expect(
      checkOpeningStock({ ...base, openingStock: { lines: [line()] } })
    ).toBeNull()
  })

  it("requires a manufacture date on each line if expiry tracked", () => {
    expect(
      checkOpeningStock({
        ...base,
        isExpiryTracked: true,
        openingStock: { lines: [line({ manufacturedOn: "2026-01-01" }), line()] },
      })
    ).toMatchObject({ error: "ITEM_EXPIRY_DATE_REQUIRED" })

    expect(
      checkOpeningStock({
        ...base,
        isExpiryTracked: true,
        openingStock: { lines: [line({ manufacturedOn: "2026-01-01" })] },
      })
    ).toBeNull()
  })
})
