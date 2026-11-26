import { describe, expect, it } from "vitest"
import {
  checkDeletable,
  checkParent,
  depthOf,
  isInSubtree,
  subtreeHeight,
  type CategoryNode,
} from "./item-category.rules.js"

//   cement
//    |- white
//    |    `- royal
//    `- gray
//   paint
const nodes: CategoryNode[] = [
  { id: "cement", parentId: null },
  { id: "white", parentId: "cement" },
  { id: "royal", parentId: "white" },
  { id: "gray", parentId: "cement" },
  { id: "paint", parentId: null },
]
const chain = (n: number): CategoryNode[] =>
  Array.from({ length: n }, (_, i) => ({ id: `n${i + 1}`, parentId: i === 0 ? null : `n${i}` }))

describe("tree helpers", () => {
  it("depthOf counts levels from the root (root = 1), 0 for unknown ids", () => {
    expect(depthOf(nodes, "cement")).toBe(1)
    expect(depthOf(nodes, "royal")).toBe(3)
    expect(depthOf(nodes, "ghost")).toBe(0)
  })
  it("subtreeHeight includes the node itself", () => {
    expect(subtreeHeight(nodes, "cement")).toBe(3)
    expect(subtreeHeight(nodes, "gray")).toBe(1)
  })
  it("isInSubtree: the node itself and every descendant", () => {
    expect(isInSubtree(nodes, "cement", "royal")).toBe(true)
    expect(isInSubtree(nodes, "cement", "cement")).toBe(true)
    expect(isInSubtree(nodes, "white", "gray")).toBe(false)
  })
  it("survive corrupt data that already contains a cycle", () => {
    const loop: CategoryNode[] = [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }]
    expect(depthOf(loop, "a")).toBe(2)
    expect(subtreeHeight(loop, "a")).toBe(2)
    expect(isInSubtree(loop, "x", "a")).toBe(false)
  })
})

describe("checkParent", () => {
  it("allows a new root and a new child of an existing category", () => {
    expect(checkParent({ nodes, parentId: null })).toBeNull()
    expect(checkParent({ nodes, parentId: "paint" })).toBeNull()
  })
  it("rejects an unknown parent", () => {
    expect(checkParent({ nodes, parentId: "ghost" })).toMatchObject({ error: "ITEM_CATEGORY_PARENT_NOT_FOUND" })
  })
  it("rejects moving a category under itself or a descendant", () => {
    expect(checkParent({ nodes, categoryId: "cement", parentId: "cement" })).toMatchObject({ error: "ITEM_CATEGORY_CYCLE" })
    expect(checkParent({ nodes, categoryId: "cement", parentId: "royal" })).toMatchObject({ error: "ITEM_CATEGORY_CYCLE" })
  })
  it("allows moving a branch somewhere unrelated, or to the root", () => {
    expect(checkParent({ nodes, categoryId: "white", parentId: "paint" })).toBeNull()
    expect(checkParent({ nodes, categoryId: "white", parentId: null })).toBeNull()
  })
  it("enforces the maximum depth, counting the moved subtree", () => {
    expect(checkParent({ nodes: chain(8), parentId: "n8" })).toMatchObject({ error: "ITEM_CATEGORY_MAX_DEPTH_EXCEEDED" })
    expect(checkParent({ nodes: chain(7), parentId: "n7" })).toBeNull()
    // "cement" has height 3: under a depth-1 parent it needs 4 levels, under depth-1 with max 3 it does not fit
    expect(checkParent({ nodes, categoryId: "cement", parentId: "paint", maxDepth: 3 })).toMatchObject({
      error: "ITEM_CATEGORY_MAX_DEPTH_EXCEEDED",
    })
    expect(checkParent({ nodes, categoryId: "cement", parentId: "paint", maxDepth: 4 })).toBeNull()
  })
})

describe("checkDeletable", () => {
  it("only an unused leaf can go", () => {
    expect(checkDeletable({ childCount: 0, itemCount: 0 })).toBeNull()
    expect(checkDeletable({ childCount: 1, itemCount: 0 })).toMatchObject({ error: "ITEM_CATEGORY_IN_USE" })
    expect(checkDeletable({ childCount: 0, itemCount: 4 })).toMatchObject({ error: "ITEM_CATEGORY_IN_USE" })
  })
})
