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
  inventoryValuationMethod: "fifo",
  isActive: true,
  allowNegativeStock: false,
  reorderPoint: "20.000000",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

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
    })
    expect(input).not.toHaveProperty("unitCollectionId")

    const viaCollection = toCreateItemInput(
      CreateItemFormSchema.parse({ ...filled, unitCollectionId: uuid(3) })
    )
    expect(viaCollection).toMatchObject({ unitCollectionId: uuid(3) })
    expect(viaCollection).not.toHaveProperty("baseUnitId")
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
