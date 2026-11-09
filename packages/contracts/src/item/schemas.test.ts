import { describe, expect, it } from "vitest"
import { CreateItemSchema, ItemOffsetListQuerySchema, UpdateItemSchema } from "./schemas.js"

const uuid = (n: number) => `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0${n}`
const base = { name: "Royal Cement", categoryId: uuid(1) }

describe("CreateItemSchema", () => {
  it("needs exactly one of baseUnitId / unitCollectionId", () => {
    expect(CreateItemSchema.safeParse(base).success).toBe(false)
    expect(CreateItemSchema.safeParse({ ...base, baseUnitId: uuid(2) }).success).toBe(true)
    expect(CreateItemSchema.safeParse({ ...base, unitCollectionId: uuid(3) }).success).toBe(true)
    expect(
      CreateItemSchema.safeParse({ ...base, baseUnitId: uuid(2), unitCollectionId: uuid(3) }).success
    ).toBe(false)
  })
  it("applies the documented defaults", () => {
    expect(CreateItemSchema.parse({ ...base, baseUnitId: uuid(2) })).toMatchObject({
      canAssembled: false,
      isReturnable: true,
      isInventoryTracked: true,
      isBatchTracked: false,
      inventoryValuationMethod: "fifo",
      allowNegativeStock: false,
    })
  })
  it("reorderPoint is a numeric(18, 6) string", () => {
    const ok = CreateItemSchema.safeParse({ ...base, baseUnitId: uuid(2), reorderPoint: "12.5" })
    const bad = CreateItemSchema.safeParse({ ...base, baseUnitId: uuid(2), reorderPoint: "1.1234567" })
    expect(ok.success).toBe(true)
    expect(bad.success).toBe(false)
  })
})

describe("UpdateItemSchema", () => {
  it("needs a field and refuses both unit selectors at once", () => {
    expect(UpdateItemSchema.safeParse({}).success).toBe(false)
    expect(UpdateItemSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(UpdateItemSchema.safeParse({ baseUnitId: uuid(2), unitCollectionId: uuid(3) }).success).toBe(false)
  })
})

describe("ItemOffsetListQuerySchema", () => {
  it("includes sub-categories by default and parses boolean strings", () => {
    expect(ItemOffsetListQuerySchema.parse({})).toMatchObject({ page: 1, includeSubcategories: true })
    expect(
      ItemOffsetListQuerySchema.parse({ includeSubcategories: "false", isActive: "true" })
    ).toMatchObject({ includeSubcategories: false, isActive: true })
  })
})
