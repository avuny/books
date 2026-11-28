import { beforeEach, describe, expect, it } from "vitest"
import { InventoryAdjustmentErrorCode as Err } from "@avuny/contracts"
import { createInventoryAdjustmentService } from "./inventory-adjustment.service.js"
import {
  dummyAccounting,
  dummyActivityLog,
  dummyBatch,
  dummyInventoryCosting,
  dummyItemConversion,
  dummyPermissions,
  dummyStockMovement,
  dummyWarehouseLocation,
  InMemoryInventoryAdjustmentRepository,
} from "./testing.js"

describe("InventoryAdjustmentService", () => {
  let repo: InMemoryInventoryAdjustmentRepository
  let service: ReturnType<typeof createInventoryAdjustmentService>

  const orgId = "11111111-1111-4111-a111-111111111111"
  const actorId = "22222222-2222-4222-a222-222222222222"
  const warehouseId = "33333333-3333-4333-a333-333333333333"
  const reasonShortageId = "44444444-4444-4444-a444-444444444444"
  const reasonSurplusId = "55555555-5555-4555-a555-555555555555"
  const itemId = "66666666-6666-4666-a666-666666666666"
  const locationId = "77777777-7777-4777-a777-777777777777"
  const unitId = "88888888-8888-4888-a888-888888888888"

  beforeEach(() => {
    repo = new InMemoryInventoryAdjustmentRepository()

    repo.reasons = [
      {
        id: reasonShortageId,
        orgId: null,
        code: "COUNT_SHORTAGE",
        name: "Count shortage",
        direction: "DECREASE",
        isSystem: true,
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: reasonSurplusId,
        orgId: null,
        code: "COUNT_SURPLUS",
        name: "Count surplus",
        direction: "INCREASE",
        isSystem: true,
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    service = createInventoryAdjustmentService({
      repository: repo,
      itemConversion: dummyItemConversion,
      warehouseLocation: dummyWarehouseLocation,
      batch: dummyBatch,
      stockMovement: dummyStockMovement,
      inventoryCosting: dummyInventoryCosting,
      accounting: dummyAccounting,
      permissions: dummyPermissions,
      activityLog: dummyActivityLog,
    })
  })

  describe("create", () => {
    it("creates a draft adjustment and calculates base quantities", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const result = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        referenceNumber: "REF-001",
        description: "Year-end count",
        lines: [
          {
            itemId,
            locationId,
            unitId,
            countedQuantity: "90",
            notes: "Damaged box discarded",
          },
        ],
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.status).toBe("DRAFT")
      expect(result.data.number).toBe("ADJ-000001")
      expect(result.data.lines).toHaveLength(1)
      expect(result.data.lines[0]?.systemQuantityBase).toBe("100")
      expect(result.data.lines[0]?.countedQuantityBase).toBe("90")
      expect(result.data.lines[0]?.quantityDeltaBase).toBe("-10")
    })

    it("rejects duplicate lines for the same dimension", async () => {
      const result = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [
          { itemId, locationId, unitId, countedQuantity: "90" },
          { itemId, locationId, unitId, countedQuantity: "95" },
        ],
      })

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe(Err.INVENTORY_ADJUSTMENT_DUPLICATE_LINES)
    })
  })

  describe("update", () => {
    it("updates draft lines and recalculates deltas", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const updateRes = await service.update(actorId, orgId, createRes.data.id, {
        description: "Corrected recount",
        lines: [{ itemId, locationId, unitId, countedQuantity: "85" }],
      })

      expect(updateRes.success).toBe(true)
      if (!updateRes.success) return
      expect(updateRes.data.description).toBe("Corrected recount")
      expect(updateRes.data.lines[0]?.countedQuantityBase).toBe("85")
      expect(updateRes.data.lines[0]?.quantityDeltaBase).toBe("-15")
    })
  })

  describe("delete", () => {
    it("deletes a draft adjustment", async () => {
      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const deleteRes = await service.delete(actorId, orgId, createRes.data.id)
      expect(deleteRes.success).toBe(true)

      const getRes = await service.get(actorId, orgId, createRes.data.id)
      expect(getRes.success).toBe(false)
    })
  })

  describe("confirm", () => {
    it("posts stock movement and marks document CONFIRMED", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes.success).toBe(true)
      if (!confirmRes.success) return

      expect(confirmRes.data.status).toBe("CONFIRMED")
      expect(confirmRes.data.confirmedBy).toBe(actorId)
      expect(confirmRes.data.confirmedAt).toBeTruthy()
      expect(confirmRes.data.stockMovementId).toBe("movement-1")
      expect(confirmRes.data.journalEntryId).toBe("je-1")
    })

    it("posts stock movement for increase adjustment with positive formatted quantity", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100.000000")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonSurplusId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "115.000000", unitCost: "250" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes.success).toBe(true)
      if (!confirmRes.success) return

      expect(confirmRes.data.status).toBe("CONFIRMED")
      expect(confirmRes.data.confirmedBy).toBe(actorId)
      expect(confirmRes.data.confirmedAt).toBeTruthy()
      expect(confirmRes.data.stockMovementId).toBe("movement-1")
      expect(confirmRes.data.journalEntryId).toBe("je-1")
    })

    it("refuses to confirm a gain without a unit cost", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100.000000")
      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonSurplusId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "115.000000" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return
      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes).toMatchObject({ success: false, error: "INVENTORY_ADJUSTMENT_COST_REQUIRED" })
    })

    it("refuses a zero cost gain without a reason", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100.000000")
      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonSurplusId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "115.000000", unitCost: "0" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return
      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes).toMatchObject({ success: false, error: "INVENTORY_ADJUSTMENT_COST_REQUIRED" })
    })

    it("rejects confirmation if count is stale", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      // Another transaction changed the stock from 100 to 110!
      repo.stock.set(`${locationId}:${itemId}:`, "110")

      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes.success).toBe(false)
      if (confirmRes.success) return
      expect(confirmRes.error).toBe(Err.INVENTORY_ADJUSTMENT_STALE_COUNT)
    })

    it("rejects confirmation if delta violates reason direction", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      // reasonShortageId is DECREASE, but counted 110 (increase)
      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "110" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes.success).toBe(false)
      if (confirmRes.success) return
      expect(confirmRes.error).toBe(Err.INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH)
    })

    it("rejects confirmation if no lines have quantity differences", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "100" }],
      })
      expect(createRes.success).toBe(true)
      if (!createRes.success) return

      const confirmRes = await service.confirm(actorId, orgId, createRes.data.id)
      expect(confirmRes.success).toBe(false)
      if (confirmRes.success) return
      expect(confirmRes.error).toBe(Err.INVENTORY_ADJUSTMENT_NO_DIFFERENCE)
    })

    it("rejects editing or deleting after confirmation", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      if (!createRes.success) return

      await service.confirm(actorId, orgId, createRes.data.id)

      const updateRes = await service.update(actorId, orgId, createRes.data.id, {
        description: "Attempted edit",
      })
      expect(updateRes.success).toBe(false)
      if (!updateRes.success) {
        expect(updateRes.error).toBe(Err.INVENTORY_ADJUSTMENT_NOT_EDITABLE)
      }

      const deleteRes = await service.delete(actorId, orgId, createRes.data.id)
      expect(deleteRes.success).toBe(false)
      if (!deleteRes.success) {
        expect(deleteRes.error).toBe(Err.INVENTORY_ADJUSTMENT_NOT_DELETABLE)
      }
    })
  })

  describe("cancel", () => {
    it("cancels a draft adjustment", async () => {
      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      if (!createRes.success) return

      const cancelRes = await service.cancel(actorId, orgId, createRes.data.id)
      expect(cancelRes.success).toBe(true)
      if (!cancelRes.success) return
      expect(cancelRes.data.status).toBe("CANCELLED")
    })

    it("cannot cancel a confirmed adjustment", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const createRes = await service.create(actorId, orgId, {
        date: "2026-11-20",
        warehouseId,
        reasonId: reasonShortageId,
        lines: [{ itemId, locationId, unitId, countedQuantity: "90" }],
      })
      if (!createRes.success) return

      await service.confirm(actorId, orgId, createRes.data.id)

      const cancelRes = await service.cancel(actorId, orgId, createRes.data.id)
      expect(cancelRes.success).toBe(false)
      if (!cancelRes.success) {
        expect(cancelRes.error).toBe(Err.INVENTORY_ADJUSTMENT_CANNOT_CANCEL_CONFIRMED)
      }
    })
  })

  describe("snapshot and reasons", () => {
    it("returns stock snapshot converted to selected unit", async () => {
      repo.stock.set(`${locationId}:${itemId}:`, "100")

      const res = await service.getSnapshot(actorId, orgId, {
        warehouseId,
        itemId,
        locationId,
        unitId,
      })

      expect(res.success).toBe(true)
      if (!res.success) return
      expect(res.data.systemQuantityBase).toBe("100")
      expect(res.data.systemQuantitySelectedUnit).toBe("100")
      expect(res.data.snapshotToken).toBeTruthy()
    })

    it("lists available active reasons", async () => {
      const res = await service.listReasons(actorId, orgId)
      expect(res.success).toBe(true)
      if (!res.success) return
      expect(res.data.items).toHaveLength(2)
      expect(res.data.items[0]?.code).toBe("COUNT_SHORTAGE")
    })
  })
})
