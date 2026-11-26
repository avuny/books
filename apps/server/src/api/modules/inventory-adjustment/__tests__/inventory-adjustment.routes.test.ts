import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import {
  InventoryAdjustmentErrorCode as Code,
  type InventoryAdjustmentDto,
} from "@avuny/contracts"
import { listInventoryAdjustmentsRoute } from "../hono-routes/list-inventory-adjustments.route.js"
import { getInventoryAdjustmentRoute } from "../hono-routes/get-inventory-adjustment.route.js"
import { createInventoryAdjustmentRoute } from "../hono-routes/create-inventory-adjustment.route.js"
import { updateInventoryAdjustmentRoute } from "../hono-routes/update-inventory-adjustment.route.js"
import { deleteInventoryAdjustmentRoute } from "../hono-routes/delete-inventory-adjustment.route.js"
import { confirmInventoryAdjustmentRoute } from "../hono-routes/confirm-inventory-adjustment.route.js"
import { cancelInventoryAdjustmentRoute } from "../hono-routes/cancel-inventory-adjustment.route.js"
import { listInventoryAdjustmentReasonsRoute } from "../hono-routes/list-inventory-adjustment-reasons.route.js"
import { getStockSnapshotRoute } from "../hono-routes/get-stock-snapshot.route.js"
import { inventoryAdjustmentOptionsRoute } from "../hono-routes/inventory-adjustment-options.route.js"

describe("inventory-adjustment routes", () => {
  const userId = "a0000000-0000-4000-a000-000000000001"
  const orgId = "a0000000-0000-4000-a000-000000000002"
  const adjustmentId = "a0000000-0000-4000-a000-000000000003"
  const warehouseId = "a0000000-0000-4000-a000-000000000004"
  const reasonId = "a0000000-0000-4000-a000-000000000005"
  const itemId = "a0000000-0000-4000-a000-000000000006"
  const locationId = "a0000000-0000-4000-a000-000000000007"
  const unitId = "a0000000-0000-4000-a000-000000000008"
  const iso = new Date().toISOString()

  const requireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", { id: userId })
    await next()
  }
  const allow = () => ((async (_c: any, next: any) => next()) as MiddlewareHandler)
  const mount = (route: ReturnType<typeof createOpenAPIRouter>) => {
    const app = createOpenAPIRouter()
    app.route("/", route)
    return app
  }

  const dummyAdjustment: InventoryAdjustmentDto = {
    id: adjustmentId,
    number: "ADJ-000001",
    referenceNumber: "REF-001",
    date: "2026-11-20",
    warehouseId,
    reasonId,
    description: "Cycle count",
    status: "DRAFT",
    createdBy: userId,
    confirmedBy: null,
    confirmedAt: null,
    stockMovementId: null,
    journalEntryId: null,
    lines: [
      {
        id: "a0000000-0000-4000-a000-000000000010",
        adjustmentId,
        lineNo: 1,
        itemId,
        locationId,
        unitId,
        batchId: null,
        countedQuantity: "15.0000",
        baseUnitId: unitId,
        systemQuantityBase: "10.0000",
        countedQuantityBase: "15.0000",
        quantityDeltaBase: "5.0000",
        snapshotToken: null,
        notes: null,
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    createdAt: iso,
    updatedAt: iso,
  }

  it("lists adjustments (200)", async () => {
    const service: any = {
      list: vi.fn().mockResolvedValue(
        ok({
          data: {
            items: [
              {
                id: adjustmentId,
                number: "ADJ-000001",
                referenceNumber: "REF-001",
                date: "2026-11-20",
                warehouseId,
                reasonId,
                status: "DRAFT" as const,
                lineCount: 1,
                createdBy: userId,
                confirmedAt: null,
                createdAt: iso,
                updatedAt: iso,
              },
            ],
            page: 1,
            pageSize: 50,
            total: 1,
          },
          msg: "ok",
        })
      ),
    }
    const app = mount(listInventoryAdjustmentsRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments?page=1&pageSize=50`)
    expect(res.status).toBe(200)
    expect(service.list).toHaveBeenCalledWith(userId, orgId, expect.objectContaining({ page: 1, pageSize: 50 }))
  })

  it("gets adjustment by ID (200)", async () => {
    const service: any = {
      get: vi.fn().mockResolvedValue(ok({ data: dummyAdjustment, msg: "ok" })),
    }
    const app = mount(getInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/${adjustmentId}`)
    expect(res.status).toBe(200)
    expect(service.get).toHaveBeenCalledWith(userId, orgId, adjustmentId)
  })

  it("returns 404 when adjustment not found", async () => {
    const service: any = {
      get: vi.fn().mockResolvedValue(fail({ error: Code.INVENTORY_ADJUSTMENT_NOT_FOUND, msg: "not found" })),
    }
    const app = mount(getInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/${adjustmentId}`)
    expect(res.status).toBe(404)
  })

  it("creates adjustment (201)", async () => {
    const service: any = {
      create: vi.fn().mockResolvedValue(ok({ data: dummyAdjustment, msg: "created" })),
    }
    const app = mount(createInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-11-20",
        warehouseId,
        reasonId,
        lines: [
          {
            itemId,
            locationId,
            unitId,
            countedQuantity: "15.0000",
          },
        ],
      }),
    })
    expect(res.status).toBe(201)
    expect(service.create).toHaveBeenCalled()
  })

  it("updates adjustment (200)", async () => {
    const service: any = {
      update: vi.fn().mockResolvedValue(ok({ data: dummyAdjustment, msg: "updated" })),
    }
    const app = mount(updateInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/${adjustmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Updated notes" }),
    })
    expect(res.status).toBe(200)
    expect(service.update).toHaveBeenCalledWith(userId, orgId, adjustmentId, { description: "Updated notes" })
  })

  it("deletes adjustment (200)", async () => {
    const service: any = {
      delete: vi.fn().mockResolvedValue(ok({ data: { id: adjustmentId }, msg: "deleted" })),
    }
    const app = mount(deleteInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/${adjustmentId}`, {
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(service.delete).toHaveBeenCalledWith(userId, orgId, adjustmentId)
  })

  it("confirms adjustment (200)", async () => {
    const confirmed = { ...dummyAdjustment, status: "CONFIRMED" as const, confirmedAt: iso, confirmedBy: userId }
    const service: any = {
      confirm: vi.fn().mockResolvedValue(ok({ data: confirmed, msg: "confirmed" })),
    }
    const app = mount(confirmInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/${adjustmentId}/confirm`, {
      method: "POST",
    })
    expect(res.status).toBe(200)
    expect(service.confirm).toHaveBeenCalledWith(userId, orgId, adjustmentId)
  })

  it("cancels adjustment (200)", async () => {
    const cancelled = { ...dummyAdjustment, status: "CANCELLED" as const }
    const service: any = {
      cancel: vi.fn().mockResolvedValue(ok({ data: cancelled, msg: "cancelled" })),
    }
    const app = mount(cancelInventoryAdjustmentRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/${adjustmentId}/cancel`, {
      method: "POST",
    })
    expect(res.status).toBe(200)
    expect(service.cancel).toHaveBeenCalledWith(userId, orgId, adjustmentId)
  })

  it("lists reasons (200)", async () => {
    const service: any = {
      listReasons: vi.fn().mockResolvedValue(
        ok({
          data: {
            items: [
              {
                id: reasonId,
                code: "PHYSICAL_COUNT",
                name: "Physical Count",
                direction: "BOTH" as const,
                isSystem: true,
                isActive: true,
                sortOrder: 1,
              },
            ],
          },
          msg: "ok",
        })
      ),
    }
    const app = mount(listInventoryAdjustmentReasonsRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/reasons`)
    expect(res.status).toBe(200)
    expect(service.listReasons).toHaveBeenCalledWith(userId, orgId)
  })

  it("gets stock snapshot (200)", async () => {
    const service: any = {
      getSnapshot: vi.fn().mockResolvedValue(
        ok({
          data: {
            systemQuantityBase: "10.0000",
            systemQuantitySelectedUnit: "10.0000",
            baseUnitId: unitId,
            selectedUnitId: unitId,
            conversionFactor: "1.0000",
            snapshotToken: "token-123",
          },
          msg: "ok",
        })
      ),
    }
    const app = mount(getStockSnapshotRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(
      `/organizations/${orgId}/inventory-adjustments/snapshot?warehouseId=${warehouseId}&locationId=${locationId}&itemId=${itemId}&unitId=${unitId}`
    )
    expect(res.status).toBe(200)
    expect(service.getSnapshot).toHaveBeenCalledWith(
      userId,
      orgId,
      expect.objectContaining({ warehouseId, locationId, itemId, unitId })
    )
  })

  it("lists options (200)", async () => {
    const service: any = {
      listOptions: vi.fn().mockResolvedValue(
        ok({
          data: { items: [{ id: adjustmentId, name: "ADJ-000001" }] },
          msg: "ok",
        })
      ),
    }
    const app = mount(inventoryAdjustmentOptionsRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/inventory-adjustments/options?limit=10`)
    expect(res.status).toBe(200)
    expect(service.listOptions).toHaveBeenCalledWith(userId, orgId, expect.objectContaining({ limit: 10 }))
  })
})
