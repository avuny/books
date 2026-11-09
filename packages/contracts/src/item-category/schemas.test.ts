import { describe, expect, it } from "vitest"
import {
  CreateItemCategorySchema,
  ItemCategoryOffsetListQuerySchema,
  UpdateItemCategorySchema,
} from "./schemas.js"

describe("item category schemas", () => {
  it("trims names and rejects empty ones", () => {
    expect(CreateItemCategorySchema.parse({ name: "  Cement " }).name).toBe("Cement")
    expect(CreateItemCategorySchema.safeParse({ name: "   " }).success).toBe(false)
  })
  it("update needs at least one field; parentId null is a real change", () => {
    expect(UpdateItemCategorySchema.safeParse({}).success).toBe(false)
    expect(UpdateItemCategorySchema.safeParse({ parentId: null }).success).toBe(true)
  })
  it("list query: defaults, boolean strings and the root marker", () => {
    const q = ItemCategoryOffsetListQuerySchema.parse({ isActive: "false", parentId: "root" })
    expect(q).toMatchObject({ page: 1, isActive: false, parentId: "root" })
    expect(ItemCategoryOffsetListQuerySchema.safeParse({ parentId: "nope" }).success).toBe(false)
  })
})
