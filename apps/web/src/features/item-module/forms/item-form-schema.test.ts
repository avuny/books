import { describe, expect, it } from "vitest"

import type { ItemDto } from "../types"
import {
  CreateItemFormSchema,
  UpdateItemFormSchema,
  getCreateItemDefaults,
  getUpdateItemDefaults,
  toCreateItemInput,
  toUpdateItemInput,
} from "./item-form-schema"

const uuid = (n: number) => `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0${n}`
const filled = {
  ...getCreateItemDefaults(),
  name: " Royal Cement ",
  categoryId: uuid(1),
}

const item: ItemDto = {
  id: uuid(9),
  orgId: uuid(8),
  name: "Royal Cement",
  description: null,
  categoryId: uuid(1),
  categoryName: "Cement",
  baseUnit: {
    id: uuid(2),
    orgId: null,
    name: "Kilogram",
    symbol: "kg",
    type: "weight",
    isActive: true,
    isSystem: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  unitCollectionId: uuid(3),
  canAssembled: false,
  isReturnable: true,
  isInventoryTracked: true,
  isBatchTracked: false,
  isExpiryTracked: false,
  expirySettings: null,
  inventoryValuationMethod: "fifo",
  isActive: true,
  allowNegativeStock: false,
  costPrice: null,
  sellingPrice: null,
  unitPrices: [],
  reorderPoint: "20.000000",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("CreateItemFormSchema category (audit B8)", () => {
  it("asks to choose a category instead of showing a raw UUID error", () => {
    const result = CreateItemFormSchema.safeParse({
      ...filled,
      baseUnitId: uuid(2),
      categoryId: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "categoryId")
      expect(issue?.message).toBe("Choose a category")
    }
  })
})

describe("CreateItemFormSchema", () => {
  it("needs exactly one of base unit / unit collection (blank counts as not picked)", () => {
    expect(CreateItemFormSchema.safeParse(filled).success).toBe(false)
    expect(
      CreateItemFormSchema.safeParse({ ...filled, baseUnitId: uuid(2) }).success
    ).toBe(true)
    expect(
      CreateItemFormSchema.safeParse({ ...filled, unitCollectionId: uuid(3) })
        .success
    ).toBe(true)
    expect(
      CreateItemFormSchema.safeParse({
        ...filled,
        baseUnitId: uuid(2),
        unitCollectionId: uuid(3),
      }).success
    ).toBe(false)
  })

  it("requires inventory tracking for batch tracking", () => {
    const res = CreateItemFormSchema.safeParse({
      ...filled,
      baseUnitId: uuid(2),
      isInventoryTracked: false,
      isBatchTracked: true,
    })
    expect(res.success).toBe(false)
  })

  it("expiry tracking only needs inventory tracking (batches are implied)", () => {
    const base = { ...filled, baseUnitId: uuid(2), isInventoryTracked: true, isBatchTracked: false, isExpiryTracked: true }
    const res = CreateItemFormSchema.safeParse(base)
    expect(res.success).toBe(true)
    if (res.success) expect(toCreateItemInput(res.data).isBatchTracked).toBe(true)
    expect(CreateItemFormSchema.safeParse({ ...base, isInventoryTracked: false }).success).toBe(false)
  })

  it("reorder point: blank or a numeric(18, 6) string", () => {
    const base = { ...filled, baseUnitId: uuid(2) }
    expect(
      CreateItemFormSchema.safeParse({ ...base, reorderPoint: "" }).success
    ).toBe(true)
    expect(
      CreateItemFormSchema.safeParse({ ...base, reorderPoint: "12.5" }).success
    ).toBe(true)
    expect(
      CreateItemFormSchema.safeParse({ ...base, reorderPoint: "1e3" }).success
    ).toBe(false)
  })
})

describe("form values -> API input", () => {
  it("create: sends the picked unit source only, blank text as null", () => {
    const values = CreateItemFormSchema.parse({
      ...filled,
      baseUnitId: uuid(2),
    })
    const input = toCreateItemInput(values)
    expect(input).toMatchObject({
      name: "Royal Cement",
      description: null,
      baseUnitId: uuid(2),
      reorderPoint: null,
      costPrice: null,
      sellingPrice: null,
    })
    expect(input).not.toHaveProperty("unitCollectionId")

    const viaCollection = toCreateItemInput(
      CreateItemFormSchema.parse({ ...filled, unitCollectionId: uuid(3) })
    )
    expect(viaCollection).toMatchObject({ unitCollectionId: uuid(3) })
    expect(viaCollection).not.toHaveProperty("baseUnitId")
  })

  it("create: keeps the per-line posting date and omits blank dates", () => {
    const values = CreateItemFormSchema.parse({
      ...filled,
      baseUnitId: uuid(2),
      openingStockLines: [
        { locationId: uuid(5), quantity: "50", manufacturedOn: "", postedAt: "2026-11-15" },
        { locationId: uuid(5), quantity: "7", manufacturedOn: "" },
      ],
    })
    const input = toCreateItemInput(values)
    expect(input.openingStock?.lines).toEqual([
      { locationId: uuid(5), quantity: "50", cost: null, manufacturedOn: null, postedAt: "2026-11-15" },
      { locationId: uuid(5), quantity: "7", cost: null, manufacturedOn: null },
    ])
    expect(input.openingStock).not.toHaveProperty("postedAt")
  })

  it("create: sends unit prices, drops empty rows", () => {
    const values = CreateItemFormSchema.parse({
      ...filled,
      baseUnitId: uuid(2),
      unitPrices: [
        { unitId: uuid(7), costPrice: "900", sellingPrice: "" },
        { unitId: uuid(8), costPrice: "", sellingPrice: "" },
      ],
    })
    expect(toCreateItemInput(values).unitPrices).toEqual([
      { unitId: uuid(7), costPrice: "900", sellingPrice: null },
    ])
  })

  it("create: a line cost defaults to its unit's cost price; unitId is omitted for the base unit", () => {
    const values = CreateItemFormSchema.parse({
      ...filled,
      baseUnitId: uuid(2),
      costPrice: "1",
      unitPrices: [{ unitId: uuid(7), costPrice: "900", sellingPrice: "" }],
      openingStockLines: [
        { locationId: uuid(5), quantity: "2", unitId: uuid(7), manufacturedOn: "" },
        { locationId: uuid(5), quantity: "3", unitId: uuid(2), manufacturedOn: "" },
        { locationId: uuid(5), quantity: "4", unitId: uuid(7), cost: "850", manufacturedOn: "" },
      ],
    })
    const lines = toCreateItemInput(values, { baseUnitId: uuid(2) }).openingStock?.lines
    expect(lines?.map((l) => [l.unitId, l.cost])).toEqual([
      [uuid(7), "900"],
      [undefined, "1"],
      [uuid(7), "850"],
    ])
  })

  it("create: maps opening stock lines with cost", () => {
    const values = CreateItemFormSchema.parse({
      ...filled,
      baseUnitId: uuid(2),
      openingStockLines: [
        {
          locationId: uuid(5),
          quantity: "50",
          cost: "12.50",
          manufacturedOn: "",
        },
      ],
    })
    const input = toCreateItemInput(values)
    expect(input.openingStock?.lines).toEqual([
      {
        locationId: uuid(5),
        quantity: "50",
        cost: "12.50",
        manufacturedOn: null,
      },
    ])
  })

  it("create: requires manufacture date on opening stock lines when expiry tracked", () => {
    const invalid = CreateItemFormSchema.safeParse({
      ...filled,
      baseUnitId: uuid(2),
      isExpiryTracked: true,
      defaultShelfLifeValue: 12,
      defaultShelfLifeUnit: "MONTH",
      openingStockLines: [
        {
          locationId: uuid(5),
          quantity: "50",
          manufacturedOn: "",
        },
      ],
    })
    expect(invalid.success).toBe(false)

    const valid = CreateItemFormSchema.safeParse({
      ...filled,
      baseUnitId: uuid(2),
      isExpiryTracked: true,
      defaultShelfLifeValue: 12,
      defaultShelfLifeUnit: "MONTH",
      openingStockLines: [
        {
          locationId: uuid(5),
          quantity: "50",
          manufacturedOn: "2026-11-15",
        },
      ],
    })
    expect(valid.success).toBe(true)
  })

  it("update: pre-fills from the item and trims the padded reorder point", () => {
    const defaults = getUpdateItemDefaults(item)
    expect(defaults).toMatchObject({
      baseUnitId: uuid(2),
      reorderPoint: "20",
      description: "",
    })
  })

  it("update: the base unit is sent only when it changed", () => {
    const same = UpdateItemFormSchema.parse(getUpdateItemDefaults(item))
    expect(toUpdateItemInput(same, item)).not.toHaveProperty("baseUnitId")

    const changed = UpdateItemFormSchema.parse({
      ...getUpdateItemDefaults(item),
      baseUnitId: uuid(4),
    })
    expect(toUpdateItemInput(changed, item)).toMatchObject({
      baseUnitId: uuid(4),
      reorderPoint: "20",
    })
  })

  it("update: clearing the reorder point sends null (not undefined)", () => {
    const values = UpdateItemFormSchema.parse({
      ...getUpdateItemDefaults(item),
      reorderPoint: "",
    })
    expect(toUpdateItemInput(values, item).reorderPoint).toBeNull()
  })
})
