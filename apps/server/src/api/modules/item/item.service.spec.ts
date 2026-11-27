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
  isExpiryTracked: false,
  inventoryValuationMethod: "fifo",
  costPrice: null,
  sellingPrice: null,
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
  expirySettings: null,
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
    upsertExpirySettings: vi.fn(async () => {}),
    replaceUnitPrices: vi.fn(async () => {}),
    findStockPolicies: vi.fn(async () => new Map()),
    deleteItem: vi.fn(async () => ({ ok: true as const })),
    deleteCreatedItemOnFailure: vi.fn(async () => {}),
  }
  const unitRepository = {
    findUnitsByIds: vi.fn(async () => [unit()]),
    findCollection: vi.fn(),
    insertCollection: vi.fn(async () => collection()),
    insertCollectionUnits: vi.fn(async () => {}),
    listCollectionUnits: vi.fn(async () => []),
  }
  const categoryRepository = { findById: vi.fn(async () => category()) }
  const stockHistory = { hasMovements: vi.fn(async () => false) }
  const activityLog = { log: vi.fn(async () => {}) }
  const permissions = { check: vi.fn(async () => true) }
  const openingStock = {
    stockMovements: {
      post: vi.fn(async () => ({ success: true, data: {} as any, msg: "ok" } as any)),
    },
    batches: {
      ensureBatches: vi.fn(async () => ({ success: true, data: [], msg: "ok" } as any)),
    },
    findOrgCurrency: vi.fn(async () => "USD"),
    accounting: {
      postInventoryOpeningBalance: vi.fn(async () => ({ success: true, data: { journalEntryId: "je-1" }, msg: "ok" } as any)),
      initializeChartOfAccounts: vi.fn(async () => ({ success: true })),
    },
  }
  const service = createItemService({
    repository: repository as unknown as ItemRepository,
    unitRepository: unitRepository as unknown as ItemServiceDeps["unitRepository"],
    categoryRepository: categoryRepository as unknown as ItemServiceDeps["categoryRepository"],
    stockHistory,
    activityLog,
    permissions,
    openingStock,
  })
  return { repository, unitRepository, categoryRepository, stockHistory, activityLog, permissions, openingStock, service }
}

const createInput = {
  name: "Royal Cement",
  categoryId: "cat-1",
  baseUnitId: "u-kg",
  canAssembled: false,
  isReturnable: true,
  isInventoryTracked: true,
  isBatchTracked: false,
  isExpiryTracked: false,
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

    it("stores default prices on create (null when omitted)", async () => {
      await t.service.create("u1", "org-1", { ...createInput, costPrice: "12.5" })
      expect(t.repository.insertItem).toHaveBeenCalledWith(
        expect.objectContaining({ costPrice: "12.5", sellingPrice: null }),
        expect.anything()
      )
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

    describe("per-unit prices and opening stock units", () => {
      const collectionUnits = [
        { link: { unitId: "u-kg", conversionFactor: "1" } },
        { link: { unitId: "u-ton", conversionFactor: "1000" } },
      ]
      const withCollection = () => {
        t.unitRepository.findCollection.mockResolvedValue(collection({ id: "c-9", baseUnitId: "u-kg" }))
        t.unitRepository.listCollectionUnits.mockResolvedValue(collectionUnits as never)
      }
      const { baseUnitId: _drop, ...noBase } = createInput

      it("saves prices of other units of the collection", async () => {
        withCollection()
        const res = await t.service.create("u1", "org-1", {
          ...noBase,
          unitCollectionId: "c-9",
          unitPrices: [{ unitId: "u-ton", costPrice: "900", sellingPrice: null }],
        })
        expect(res).toMatchObject({ success: true })
        expect(t.repository.replaceUnitPrices).toHaveBeenCalledWith(
          "org-1",
          "item-1",
          [{ unitId: "u-ton", costPrice: "900", sellingPrice: null }],
          expect.anything()
        )
      })

      it("refuses prices for the base unit or a unit outside the collection, before writing", async () => {
        withCollection()
        for (const unitId of ["u-kg", "u-other"]) {
          const res = await t.service.create("u1", "org-1", {
            ...noBase,
            unitCollectionId: "c-9",
            unitPrices: [{ unitId, costPrice: "1" }],
          })
          expect(res).toMatchObject({ success: false, error: "ITEM_UNIT_PRICE_UNIT_INVALID" })
        }
        expect(t.repository.insertItem).not.toHaveBeenCalled()
      })

      it("a new single-unit collection has no other unit to price", async () => {
        const res = await t.service.create("u1", "org-1", {
          ...createInput,
          unitPrices: [{ unitId: "u-ton", costPrice: "1" }],
        })
        expect(res).toMatchObject({ success: false, error: "ITEM_UNIT_PRICE_UNIT_INVALID" })
        expect(t.unitRepository.insertCollection).not.toHaveBeenCalled()
      })

      it("converts an opening stock line entered in another unit to the base unit", async () => {
        withCollection()
        const res = await t.service.create("u1", "org-1", {
          ...noBase,
          unitCollectionId: "c-9",
          openingStock: { lines: [{ locationId: "loc-1", quantity: "2", unitId: "u-ton", cost: "900" }] },
        })
        expect(res).toMatchObject({ success: true })
        expect(t.openingStock.stockMovements.post).toHaveBeenCalledWith(
          "u1",
          "org-1",
          expect.objectContaining({ lines: [expect.objectContaining({ quantity: "2000" })] }),
          expect.anything()
        )
        // value = 2 ton x 900 = 1800 (computed from the entered values, not rounded base values)
        expect(t.openingStock.accounting.postInventoryOpeningBalance).toHaveBeenCalledWith(
          "u1",
          "org-1",
          expect.objectContaining({ amountMinor: "1800" }),
          expect.anything()
        )
      })

      it("refuses an opening stock unit outside the collection", async () => {
        withCollection()
        const res = await t.service.create("u1", "org-1", {
          ...noBase,
          unitCollectionId: "c-9",
          openingStock: { lines: [{ locationId: "loc-1", quantity: "2", unitId: "u-other" }] },
        })
        expect(res).toMatchObject({ success: false, error: "ITEM_OPENING_STOCK_UNIT_INVALID" })
        expect(t.repository.insertItem).not.toHaveBeenCalled()
      })

      it("posts one movement per distinct line date, the item being the source of the first", async () => {
        const res = await t.service.create("u1", "org-1", {
          ...createInput,
          openingStock: {
            lines: [
              { locationId: "loc-1", quantity: "1", postedAt: "2026-01-01T00:00:00.000Z" },
              { locationId: "loc-2", quantity: "2", postedAt: "2026-02-01T00:00:00.000Z" },
              { locationId: "loc-3", quantity: "3", postedAt: "2026-01-01T00:00:00.000Z" },
            ],
          },
        })
        expect(res).toMatchObject({ success: true })
        const calls = t.openingStock.stockMovements.post.mock.calls as unknown as [string, string, any][]
        expect(calls).toHaveLength(2)
        expect(calls[0]![2]).toMatchObject({ postedAt: "2026-01-01T00:00:00.000Z", sourceId: "item-1" })
        expect(calls[0]![2].lines.map((l: any) => l.quantity)).toEqual(["1", "3"])
        expect(calls[1]![2]).toMatchObject({ postedAt: "2026-02-01T00:00:00.000Z" })
        expect(calls[1]![2].sourceId).not.toBe("item-1")
      })

      it("update replaces the per-unit prices when provided", async () => {
        t.repository.findById.mockResolvedValue(item({ unitCollectionId: "c-9" }))
        t.unitRepository.listCollectionUnits.mockResolvedValue(collectionUnits as never)
        const res = await t.service.update("u1", "org-1", "item-1", {
          unitPrices: [{ unitId: "u-ton", sellingPrice: "1100" }],
        })
        expect(res).toMatchObject({ success: true })
        expect(t.repository.replaceUnitPrices).toHaveBeenCalledWith(
          "org-1",
          "item-1",
          [{ unitId: "u-ton", costPrice: null, sellingPrice: "1100" }],
          expect.anything()
        )
      })
    })

    it("posts opening stock when provided", async () => {
      const res = await t.service.create("u1", "org-1", {
        ...createInput,
        openingStock: {
          lines: [{ locationId: "loc-1", quantity: "10" }],
        },
      })
      expect(res).toMatchObject({ success: true })
      expect(t.openingStock.stockMovements.post).toHaveBeenCalledWith(
        "u1",
        "org-1",
        expect.objectContaining({
          type: "opening",
          lines: [expect.objectContaining({ toLocationId: "loc-1", quantity: "10" })],
        }),
        expect.anything()
      )
      expect(t.openingStock.accounting.postInventoryOpeningBalance).toHaveBeenCalledWith(
        "u1",
        "org-1",
        expect.objectContaining({
          sourceType: "item_opening",
          sourceId: "item-1",
          sourceRef: "Royal Cement",
          currency: "USD",
        }),
        expect.anything()
      )
    })

    it("posts to accounting with computed minor amount when lines have cost", async () => {
      const res = await t.service.create("u1", "org-1", {
        ...createInput,
        openingStock: {
          lines: [{ locationId: "loc-1", quantity: "10", cost: "25.50" }],
        },
      })
      expect(res).toMatchObject({ success: true })
      expect(t.openingStock.accounting.postInventoryOpeningBalance).toHaveBeenCalledWith(
        "u1",
        "org-1",
        expect.objectContaining({
          sourceType: "item_opening",
          sourceId: "item-1",
          sourceRef: "Royal Cement",
          amountMinor: "255",
          currency: "USD",
        }),
        expect.anything()
      )
    })

    it("cleans up inserted item and aborts when accounting post fails", async () => {
      t.openingStock.accounting.postInventoryOpeningBalance.mockResolvedValueOnce({
        success: false,
        error: "ACCOUNTING_CURRENCY_MISMATCH" as any,
        msg: "The opening stock is valued in USD but the books are kept in EGP",
      })
      const res = await t.service.create("u1", "org-1", {
        ...createInput,
        openingStock: {
          lines: [{ locationId: "loc-1", quantity: "10", cost: "25.50" }],
        },
      })
      expect(res).toMatchObject({
        success: false,
        msg: "The opening stock is valued in USD but the books are kept in EGP",
      })
      expect(t.repository.deleteCreatedItemOnFailure).toHaveBeenCalledWith("org-1", "item-1", expect.anything())
    })

    it("cleans up inserted item (compensation) and maps error when opening stock fails", async () => {
      t.openingStock.stockMovements.post.mockResolvedValue({
        success: false,
        error: "STOCK_MOVEMENT_EXPIRY_DATE_REQUIRED" as any,
        msg: "Expiry date is required for expiry-tracked items",
      })
      const res = await t.service.create("u1", "org-1", {
        ...createInput,
        openingStock: {
          lines: [{ locationId: "loc-1", quantity: "10" }],
        },
      })
      expect(res).toMatchObject({
        success: false,
        error: "ITEM_EXPIRY_DATE_REQUIRED",
        msg: "Expiry date is required for expiry-tracked items",
      })
      expect(t.repository.deleteCreatedItemOnFailure).toHaveBeenCalledWith("org-1", "item-1", expect.anything())
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

    it("turning inventory tracking off while expiry is tracked is refused", async () => {
      t.repository.findById.mockResolvedValue(item({ isBatchTracked: true, isExpiryTracked: true }))
      const res = await t.service.update("u1", "org-1", "item-1", { isInventoryTracked: false })
      expect(res).toMatchObject({ success: false, error: "ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING" })
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

    it("default prices go to the item row", async () => {
      await t.service.update("u1", "org-1", "item-1", { costPrice: "12.5", sellingPrice: null })
      expect(t.repository.updateItem).toHaveBeenCalledWith(
        "org-1",
        "item-1",
        { costPrice: "12.5", sellingPrice: null },
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
