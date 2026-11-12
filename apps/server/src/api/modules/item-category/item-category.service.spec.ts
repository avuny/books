import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ItemCategory, Tx } from "@avuny/db"
import { createItemCategoryService } from "./item-category.service.js"
import type { ItemCategoryRepository } from "./item-category.repository.js"

const NOW = new Date("2026-11-08T09:00:00Z")
const category = (o: Partial<ItemCategory> = {}): ItemCategory => ({
  id: "cat-1",
  orgId: "org-1",
  parentId: null,
  name: "Cement",
  description: null,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
const node = (id: string, parentId: string | null = null) => ({ id, parentId, name: id, isActive: true })

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    lockOrgCategories: vi.fn(async () => {}),
    findById: vi.fn(),
    listNodes: vi.fn(async () => [node("cat-1"), node("cat-2", "cat-1")]),
    counts: vi.fn(async () => ({ childCount: 0, itemCount: 0 })),
    nameTaken: vi.fn(async () => false),
    list: vi.fn(),
    insertCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  }
  const activityLog = { log: vi.fn(async () => {}) }
  const permissions = { check: vi.fn(async () => true) }
  const service = createItemCategoryService({
    repository: repository as unknown as ItemCategoryRepository,
    activityLog,
    permissions,
  })
  return { repository, activityLog, permissions, service }
}

describe("itemCategoryService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("create", () => {
    it("rejects caller without permission", async () => {
      t.permissions.check.mockResolvedValueOnce(false)
      const res = await t.service.create("u1", "org-1", { name: "White" })
      expect(res).toMatchObject({ success: false, error: "ITEM_CATEGORY_FORBIDDEN" })
    })

    it("rejects an unknown parent, under the lock", async () => {
      const res = await t.service.create("u1", "org-1", { name: "White", parentId: "ghost" })
      expect(res).toMatchObject({ success: false, error: "ITEM_CATEGORY_PARENT_NOT_FOUND" })
      expect(t.repository.lockOrgCategories).toHaveBeenCalled()
      expect(t.repository.insertCategory).not.toHaveBeenCalled()
    })

    it("rejects a duplicate sibling name", async () => {
      t.repository.nameTaken.mockResolvedValue(true)
      const res = await t.service.create("u1", "org-1", { name: "cement" })
      expect(res).toMatchObject({ success: false, error: "ITEM_CATEGORY_NAME_TAKEN" })
      expect(t.repository.nameTaken).toHaveBeenCalledWith("org-1", null, "cement", undefined, expect.anything())
    })

    it("creates, maps the unique-index race to NAME_TAKEN, and audits", async () => {
      t.repository.insertCategory.mockResolvedValueOnce({ ok: false, reason: "name_taken" })
      expect(await t.service.create("u1", "org-1", { name: "X" })).toMatchObject({ error: "ITEM_CATEGORY_NAME_TAKEN" })

      t.repository.insertCategory.mockResolvedValueOnce({ ok: true, row: category({ id: "cat-3", parentId: "cat-1" }) })
      const res = await t.service.create("u1", "org-1", { name: "White", parentId: "cat-1" })
      expect(res).toMatchObject({ success: true, data: { id: "cat-3", childCount: 0, itemCount: 0 } })
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "item_category.created" }))
    })
  })

  describe("update", () => {
    it("refuses a move under its own descendant", async () => {
      t.repository.findById.mockResolvedValue(category())
      const res = await t.service.update("u1", "org-1", "cat-1", { parentId: "cat-2" })
      expect(res).toMatchObject({ success: false, error: "ITEM_CATEGORY_CYCLE" })
      expect(t.repository.updateCategory).not.toHaveBeenCalled()
    })

    it("a plain rename skips the tree rules but still checks sibling names", async () => {
      t.repository.findById.mockResolvedValue(category())
      t.repository.updateCategory.mockResolvedValue({ ok: true, row: category({ name: "Concrete" }) })
      const res = await t.service.update("u1", "org-1", "cat-1", { name: "Concrete" })
      expect(res).toMatchObject({ success: true })
      expect(t.repository.listNodes).not.toHaveBeenCalled()
      expect(t.repository.nameTaken).toHaveBeenCalledWith("org-1", null, "Concrete", "cat-1", expect.anything())
    })

    it("only sends the fields that were provided", async () => {
      t.repository.findById.mockResolvedValue(category())
      t.repository.updateCategory.mockResolvedValue({ ok: true, row: category({ isActive: false }) })
      await t.service.update("u1", "org-1", "cat-1", { isActive: false })
      expect(t.repository.updateCategory).toHaveBeenCalledWith("org-1", "cat-1", { isActive: false }, expect.anything())
    })

    it("unknown id is a not-found failure", async () => {
      t.repository.findById.mockResolvedValue(null)
      expect(await t.service.update("u1", "org-1", "x", { isActive: false })).toMatchObject({
        error: "ITEM_CATEGORY_NOT_FOUND",
      })
    })
  })

  describe("remove", () => {
    it("refuses categories with sub-categories or items", async () => {
      t.repository.findById.mockResolvedValue(category())
      t.repository.counts.mockResolvedValue({ childCount: 1, itemCount: 0 })
      expect(await t.service.remove("u1", "org-1", "cat-1")).toMatchObject({ error: "ITEM_CATEGORY_IN_USE" })
      expect(t.repository.deleteCategory).not.toHaveBeenCalled()
    })

    it("deletes an unused leaf and audits", async () => {
      t.repository.findById.mockResolvedValue(category())
      t.repository.deleteCategory.mockResolvedValue({ ok: true })
      expect(await t.service.remove("u1", "org-1", "cat-1")).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "item_category.deleted" }))
    })
  })

  describe("list", () => {
    it('translates parentId "root" into "roots only"', async () => {
      t.repository.list.mockResolvedValue({ rows: [], total: 0 })
      await t.service.list("org-1", { page: 1, pageSize: 20, parentId: "root" })
      expect(t.repository.list).toHaveBeenCalledWith("org-1", expect.objectContaining({ parentId: null }))
    })
  })
})
