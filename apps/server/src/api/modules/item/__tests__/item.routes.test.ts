import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import { ItemErrorCode } from "@avuny/contracts"
import { listItemsRoute } from "../hono-routes/list-items.route.js"
import { createItemRoute } from "../hono-routes/create-item.route.js"
import { getItemRoute } from "../hono-routes/get-item.route.js"
import { updateItemRoute } from "../hono-routes/update-item.route.js"

describe("item routes", () => {
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
  const itemId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
  const categoryId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"
  const unitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05"
  const collectionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06"
  const iso = new Date().toISOString()

  const requireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" })
    await next()
  }
  const allow = () => (async (_c: any, next: any) => next()) as MiddlewareHandler
  const mount = (route: ReturnType<typeof createOpenAPIRouter>) => {
    const app = createOpenAPIRouter()
    app.route("/", route)
    return app
  }
  const baseUnit = { id: unitId, name: "Kilogram", symbol: "kg", type: "weight" }
  const dto = {
    id: itemId, orgId, name: "Royal Cement", description: null, categoryId, categoryName: "Cement",
    baseUnit, unitCollectionId: collectionId, canAssembled: false, isReturnable: true,
    isInventoryTracked: true, isBatchTracked: false, inventoryValuationMethod: "fifo", isActive: true,
    allowNegativeStock: false, reorderPoint: null, createdAt: iso, updatedAt: iso,
  }

  it("lists items; includeSubcategories defaults to true", async () => {
    const service: any = {
      list: vi.fn().mockResolvedValue(ok({ data: { items: [], page: 1, pageSize: 20, total: 0 }, msg: "ok" })),
    }
    const app = mount(listItemsRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/items?categoryId=${categoryId}`)
    expect(res.status).toBe(200)
    expect(service.list).toHaveBeenCalledWith(
      orgId,
      { page: 1, pageSize: 20, categoryId, includeSubcategories: true },
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
    )
  })

  it("creates an item (201) with defaults filled in", async () => {
    const service: any = { create: vi.fn().mockResolvedValue(ok({ data: dto, msg: "created" })) }
    const app = mount(createItemRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Royal Cement", categoryId, baseUnitId: unitId }),
    })
    expect(res.status).toBe(201)
    expect(service.create).toHaveBeenCalledWith(
      expect.any(String),
      orgId,
      expect.objectContaining({ isInventoryTracked: true, inventoryValuationMethod: "fifo" })
    )
  })

  it("rejects a create that gives both unit selectors (validation error, service untouched)", async () => {
    const service: any = { create: vi.fn() }
    const app = mount(createItemRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X", categoryId, baseUnitId: unitId, unitCollectionId: collectionId }),
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBeLessThan(500)
    expect(service.create).not.toHaveBeenCalled()
  })

  it("maps ITEM_NOT_FOUND to 404", async () => {
    const service: any = {
      getById: vi.fn().mockResolvedValue(fail({ error: ItemErrorCode.ITEM_NOT_FOUND, msg: "nope" })),
    }
    const app = mount(getItemRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/items/${itemId}`)
    expect(res.status).toBe(404)
  })

  it("maps ITEM_LOCKED_FIELD to 409", async () => {
    const service: any = {
      update: vi.fn().mockResolvedValue(fail({ error: ItemErrorCode.ITEM_LOCKED_FIELD, msg: "locked" })),
    }
    const app = mount(updateItemRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBatchTracked: true }),
    })
    expect(res.status).toBe(409)
  })
})
