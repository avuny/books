import { describe, expect, it } from "vitest"

import { normalizeItemCategory, statusToIsActive } from "./item-category-api"

describe("item-category-api normalization", () => {
  it("fills missing optional fields with null", () => {
    const category = normalizeItemCategory({
      id: "c1",
      orgId: "o1",
      name: "Cement",
      isActive: true,
      childCount: 2,
      itemCount: 5,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(category.parentId).toBeNull()
    expect(category.description).toBeNull()
    expect(category.childCount).toBe(2)
  })

  it("maps the status tab to the isActive query value", () => {
    expect(statusToIsActive("all")).toBeUndefined()
    expect(statusToIsActive("active")).toBe("true")
    expect(statusToIsActive("inactive")).toBe("false")
  })
})
