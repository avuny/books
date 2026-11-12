import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import { UnitCollectionErrorCode } from "@avuny/contracts"
import { listUnitCollectionsRoute } from "../hono-routes/list-unit-collections.route.js"
import { getUnitCollectionRoute } from "../hono-routes/get-unit-collection.route.js"
import { createUnitCollectionRoute } from "../hono-routes/create-unit-collection.route.js"
import { deleteUnitCollectionRoute } from "../hono-routes/delete-unit-collection.route.js"

describe("unit collection routes", () => {
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
  const collectionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
  const unitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"
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

  const collectionDto = {
    id: collectionId,
    orgId,
    name: "Meter (m)",
    baseUnitId: unitId,
    units: [{ id: unitId, name: "Meter", symbol: "m", type: "length", conversionFactor: "1", isBase: true }],
    itemCount: 0,
    createdAt: iso,
    updatedAt: iso,
  }

  it("lists collections", async () => {
    const service: any = {
      listCollections: vi.fn().mockResolvedValue(ok({ data: { items: [], page: 1, pageSize: 20, total: 0 }, msg: "ok" })),
    }
    const app = mount(listUnitCollectionsRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/unit-collections`)
    const userId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
    expect(res.status).toBe(200)
    expect(service.listCollections).toHaveBeenCalledWith(orgId, { page: 1, pageSize: 20 }, userId)
  })

  it("creates a collection (201) and passes the validated body on", async () => {
    const service: any = { createCollection: vi.fn().mockResolvedValue(ok({ data: collectionDto, msg: "created" })) }
    const app = mount(createUnitCollectionRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/unit-collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUnitId: unitId }),
    })
    expect(res.status).toBe(201)
    expect(service.createCollection).toHaveBeenCalledWith(expect.any(String), orgId, { baseUnitId: unitId, units: [] })
  })

  it("maps UNIT_COLLECTION_NOT_FOUND to 404", async () => {
    const service: any = {
      getCollection: vi.fn().mockResolvedValue(fail({ error: UnitCollectionErrorCode.UNIT_COLLECTION_NOT_FOUND, msg: "nope" })),
    }
    const app = mount(getUnitCollectionRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/unit-collections/${collectionId}`)
    expect(res.status).toBe(404)
  })

  it("maps UNIT_COLLECTION_IN_USE to 409", async () => {
    const service: any = {
      deleteCollection: vi.fn().mockResolvedValue(fail({ error: UnitCollectionErrorCode.UNIT_COLLECTION_IN_USE, msg: "used" })),
    }
    const app = mount(deleteUnitCollectionRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/unit-collections/${collectionId}`, { method: "DELETE" })
    expect(res.status).toBe(409)
  })
})

