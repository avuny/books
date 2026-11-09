import { describe, expect, it } from "vitest"

import {
  ItemCategoryFormSchema,
  toCreateItemCategoryInput,
  toUpdateItemCategoryInput,
} from "./item-category-form-schema"

const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
const base = { name: " Cement ", description: "", parentId: "", isActive: true }

describe("ItemCategoryFormSchema", () => {
  it("trims the name and treats a cleared parent as top level", () => {
    const values = ItemCategoryFormSchema.parse(base)
    expect(values.name).toBe("Cement")
    expect(values.parentId).toBeNull()
  })

  it("rejects an empty name and a malformed parent id", () => {
    expect(ItemCategoryFormSchema.safeParse({ ...base, name: "  " }).success).toBe(false)
    expect(ItemCategoryFormSchema.safeParse({ ...base, parentId: "nope" }).success).toBe(false)
  })
})

describe("form values -> API input", () => {
  it("create: blank description becomes null, parent is kept", () => {
    const values = ItemCategoryFormSchema.parse({ ...base, parentId: uuid })
    expect(toCreateItemCategoryInput(values)).toEqual({ name: "Cement", description: null, parentId: uuid })
  })

  it("update: sends every editable field, including isActive and a null parent", () => {
    const values = ItemCategoryFormSchema.parse({ ...base, description: "Bags", isActive: false })
    expect(toUpdateItemCategoryInput(values)).toEqual({
      name: "Cement",
      description: "Bags",
      parentId: null,
      isActive: false,
    })
  })
})
