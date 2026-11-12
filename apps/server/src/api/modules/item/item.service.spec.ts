import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Item, ItemCategory, Tx, Unit, UnitCollection } from "@avuny/db"
import { createItemService } from "./item.service.js"
import type { ItemRepository, ItemRow } from "./item.repository.js"
import type { ItemServiceDeps } from "./item.types.js"

const NOW = new Date("2026-11-08T09:00:00Z")
const item = (o: Partial<Item> = {}): Item => ({
  id: "item-1",
  orgId: "org-1",
  name: "Royal Cement",
  description: null,
  baseUnitId: "u-kg",
  unitCollectionId: "c-1",
  categoryId: "cat-1",
  canAssembled: false,
  isReturnable: true,
  isInventoryTracked: true,
  isBatchTracked: false,
  inventoryValuationMethod: "fifo",
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
const unit = (o: Partial<Unit> = {}): Unit => ({
  id: "u-kg",
  orgId: null,
  name: "Kilogram",
  symbol: "kg",
  type: "weight",
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
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
const collection = (o: Partial<UnitCollection> = {}): UnitCollection => ({
  id: "c-1",
  orgId: "org-1",
  baseUnitId: "u-kg",
  name: "Kilogram (kg)",
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
const detail = (o: Partial<Item> = {}): ItemRow => ({
  item: item(o),
  settings: null,
  categoryName: "Cement",
  unit: unit(),
})

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    lockOrgItems: vi.fn(async () => {}),
    findById: vi.fn(),
    findDetail: vi.fn(async () => detail()),
    list: vi.fn(),
    listOptions: vi.fn(),
    nameTaken: vi.fn(async () => false),
    insertItem: vi.fn(async () => ({ ok: true as const, row: item() })),
    updateItem: vi.fn(async () => ({ ok: true as const, row: item() })),
    upsertSettings: vi.fn(async () => {}),
    deleteItem: vi.fn(async () => ({ ok: true as const })),
  }
  const unitRepository = {
    findUnitsByIds: vi.fn(async () => [unit()]),
    findCollection: vi.fn(),
    insertCollection: vi.fn(async () => collection()),
    insertCollectionUnits: vi.fn(async () => {}),
  }
  const categoryRepository = { findById: vi.fn(async () => category()) }
  const stockHistory = { hasMovements: vi.fn(async () => false) }
  const activityLog = { log: vi.fn(async () => {}) }
  const permissions = { check: vi.fn(async () => true) }
  const service = createItemService({
    repository: repository as unknown as ItemRepository,
    unitRepository: unitRepository as unknown as ItemServiceDeps["unitRepository"],
    categoryRepository: categoryRepository as unknown as ItemServiceDeps["categoryRepository"],
    stockHistory,
    activityLog,
    permissions,
  })
  return { repository, unitRepository, categoryRepository, stockHistory, activityLog, permissions, service }
}

const createInput = {
  name: "Royal Cement",
  categoryId: "cat-1",
  baseUnitId: "u-kg",
  canAssembled: false,
  isReturnable: true,
  isInventoryTracked: true,
  isBatchTracked: false,
  inventoryValuationMethod: "fifo" as const,
  allowNegativeStock: false,
}

describe("itemService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("create", () => {
    it("rejects caller without permission", async () => {
      t.permissions.check.mockResolvedValueOnce(false)
      const res = await t.service.create("u1", "org-1", createInput)
      expect(res).toMatchObject({ success: false, error: "ITEM_FORBIDDEN" })
    })

    it("batch tracking without inventory tracking fails before any query", async () => {
      const res = await t.service.create("u1", "org-1", { ...createInput, isInventoryTracked: false, isBatchTracked: true })
      expect(res).toMatchObject({ success: false, error: "ITEM_BATCH_REQUIRES_TRACKING" })
      expect(t.repository.transaction).not.toHaveBeenCalled()
    })

    it("needs an active category of the organization", async () => {
      t.categoryRepository.findById.mockResolvedValue(category({ isActive: false }) as never)
      const res = await t.service.create("u1", "org-1", createInput)
      expect(res).toMatchObject({ success: false, error: "ITEM_CATEGORY_INVALID" })
      expect(t.repository.insertItem).not.toHaveBeenCalled()
    })

    it("a name clash fails before the automatic collection is created", async () => {
      t.repository.nameTaken.mockResolvedValue(true)
      const res = await t.service.create("u1", "org-1", createInput)
      expect(res).toMatchObject({ success: false, error: "ITEM_NAME_TAKEN" })
      expect(t.unitRepository.insertCollection).not.toHaveBeenCalled()
    })

    it("from a base unit: creates the collection (base unit at factor 1), the item and its settings", async () => {
      const res = await t.service.create("u1", "org-1", { ...createInput, reorderPoint: "10" })
      expect(res).toMatchObject({ success: true, data: { id: "item-1", categoryName: "Cement" } })
      expect(t.unitRepository.insertCollection).toHaveBeenCalledWith(
        { orgId: "org-1", baseUnitId: "u-kg", name: "Kilogram (kg)" },
        expect.anything()
      )
      expect(t.unitRepository.insertCollectionUnits).toHaveBeenCalledWith(
        "c-1",
        [{ unitId: "u-kg", conversionFactor: "1" }],
        expect.anything()
      )
      expect(t.repository.insertItem).toHaveBeenCalledWith(
        expect.objectContaining({ baseUnitId: "u-kg", unitCollectionId: "c-1", categoryId: "cat-1" }),
        expect.anything()
      )
      expect(t.repository.upsertSettings).toHaveBeenCalledWith(
        "org-1",
        "item-1",
        { allowNegativeStock: false, reorderPoint: "10" },
        expect.anything()
      )
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "item.created" }))
    })

    it("from an existing collection: reuses it and takes its base unit", async () => {
      t.unitRepository.findCollection.mockResolvedValue(collection({ id: "c-9", baseUnitId: "u-m" }))
      const { baseUnitId: _drop, ...rest } = createInput
      await t.service.create("u1", "org-1", { ...rest, unitCollectionId: "c-9" })
      expect(t.unitRepository.insertCollection).not.toHaveBeenCalled()
      expect(t.repository.insertItem).toHaveBeenCalledWith(
        expect.objectContaining({ baseUnitId: "u-m", unitCollectionId: "c-9" }),
        expect.anything()
      )
    })

    it("an unknown collection is refused", async () => {
      t.unitRepository.findCollection.mockResolvedValue(null)
      const { baseUnitId: _drop, ...rest } = createInput
      const res = await t.service.create("u1", "org-1", { ...rest, unitCollectionId: "nope" })
      expect(res).toMatchObject({ success: false, error: "ITEM_UNIT_COLLECTION_INVALID" })
    })

    it("a lost name race after the collection was written rolls the transaction back (abort)", async () => {
      t.repository.insertItem.mockResolvedValue({ ok: false, reason: "name_taken" } as never)
      const res = await t.service.create("u1", "org-1", createInput)
      expect(res).toMatchObject({ success: false, error: "ITEM_NAME_TAKEN" })
      expect(t.repository.upsertSettings).not.toHaveBeenCalled()
    })
  })

  describe("update", () => {
    beforeEach(() => {
      t.repository.findById.mockResolvedValue(item())
    })

    it("unit and tracking changes are refused once the item has stock movements", async () => {
      t.stockHistory.hasMovements.mockResolvedValue(true)
      const res = await t.service.update("u1", "org-1", "item-1", { isBatchTracked: true })
      expect(res).toMatchObject({ success: false, error: "ITEM_LOCKED_FIELD" })
      expect(t.repository.updateItem).not.toHaveBeenCalled()
    })

    it("a harmless edit does not even ask the stock module", async () => {
      await t.service.update("u1", "org-1", "item-1", { description: "Grey bag, 50 kg", isActive: false })
      expect(t.stockHistory.hasMovements).not.toHaveBeenCalled()
      expect(t.repository.updateItem).toHaveBeenCalledWith(
        "org-1",
        "item-1",
        { description: "Grey bag, 50 kg", isActive: false },
        expect.anything()
      )
      expect(t.repository.upsertSettings).not.toHaveBeenCalled()
    })

    it("turning inventory tracking off while batches are tracked is refused", async () => {
      t.repository.findById.mockResolvedValue(item({ isBatchTracked: true }))
      const res = await t.service.update("u1", "org-1", "item-1", { isInventoryTracked: false })
      expect(res).toMatchObject({ success: false, error: "ITEM_BATCH_REQUIRES_TRACKING" })
    })

    it("switching to another base unit builds a new collection and writes the unit pair together", async () => {
      t.unitRepository.findUnitsByIds.mockResolvedValue([unit({ id: "u-g", name: "Gram", symbol: "g" })])
      t.unitRepository.insertCollection.mockResolvedValue(collection({ id: "c-2", baseUnitId: "u-g" }))
      await t.service.update("u1", "org-1", "item-1", { baseUnitId: "u-g" })
      expect(t.repository.updateItem).toHaveBeenCalledWith(
        "org-1",
        "item-1",
        { baseUnitId: "u-g", unitCollectionId: "c-2" },
        expect.anything()
      )
    })

    it("settings go to the settings row, only the provided fields", async () => {
      await t.service.update("u1", "org-1", "item-1", { reorderPoint: null })
      expect(t.repository.upsertSettings).toHaveBeenCalledWith("org-1", "item-1", { reorderPoint: null }, expect.anything())
    })

    it("unknown item", async () => {
      t.repository.findById.mockResolvedValue(null)
      expect(await t.service.update("u1", "org-1", "x", { isActive: false })).toMatchObject({ error: "ITEM_NOT_FOUND" })
    })
  })

  describe("remove", () => {
    it("items with stock history are not deleted", async () => {
      t.repository.findById.mockResolvedValue(item())
      t.stockHistory.hasMovements.mockResolvedValue(true)
      expect(await t.service.remove("u1", "org-1", "item-1")).toMatchObject({ error: "ITEM_HAS_HISTORY" })
      expect(t.repository.deleteItem).not.toHaveBeenCalled()
    })

    it("an item without history is deleted and audited", async () => {
      t.repository.findById.mockResolvedValue(item())
      expect(await t.service.remove("u1", "org-1", "item-1")).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "item.deleted" }))
    })
  })

  describe("list", () => {
    it("passes the filters through", async () => {
      t.repository.list.mockResolvedValue({ rows: [], total: 0 })
      await t.service.list("org-1", { page: 2, pageSize: 10, categoryId: "cat-1", includeSubcategories: false, isActive: true })
      expect(t.repository.list).toHaveBeenCalledWith("org-1", {
        search: undefined,
        categoryId: "cat-1",
        includeSubcategories: false,
        isActive: true,
        page: 2,
        pageSize: 10,
      })
    })
  })
})
