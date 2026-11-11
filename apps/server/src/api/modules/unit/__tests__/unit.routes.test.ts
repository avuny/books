import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import { UnitErrorCode } from "@avuny/contracts"
import { listUnitsRoute } from "../hono-routes/list-units.route.js"
import { getUnitRoute } from "../hono-routes/get-unit.route.js"
import { createUnitRoute } from "../hono-routes/create-unit.route.js"
import { updateUnitRoute } from "../hono-routes/update-unit.route.js"
import { deleteUnitRoute } from "../hono-routes/delete-unit.route.js"

describe("unit routes", () => {
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
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

  const unitDto = {
    id: unitId,
    orgId,
    name: "Kilogram",
    symbol: "kg",
    type: "weight" as const,
    isActive: true,
    isSystem: false,
    createdAt: iso,
    updatedAt: iso,
  }

  it("lists units (200)", async () => {
    const service: any = {
      listUnits: vi.fn().mockResolvedValue(ok({ data: { items: [unitDto], page: 1, pageSize: 50, total: 1 }, msg: "ok" })),
    }
    const app = mount(listUnitsRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/units`)
    expect(res.status).toBe(200)
    expect(service.listUnits).toHaveBeenCalledWith(orgId, { page: 1, pageSize: 50 })
  })

  it("creates a unit (201)", async () => {
    const service: any = {
      createUnit: vi.fn().mockResolvedValue(ok({ data: unitDto, msg: "created" })),
    }
    const app = mount(createUnitRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Kilogram", symbol: "kg", type: "weight" }),
    })
    expect(res.status).toBe(201)
  })

  it("maps UNIT_NAME_TAKEN to 409", async () => {
    const service: any = {
      createUnit: vi.fn().mockResolvedValue(fail({ error: UnitErrorCode.UNIT_NAME_TAKEN, msg: "taken" })),
    }
    const app = mount(createUnitRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Kilogram", symbol: "kg", type: "weight" }),
    })
    expect(res.status).toBe(409)
  })

  it("maps UNIT_SYSTEM_IMMUTABLE to 400", async () => {
    const service: any = {
      deleteUnit: vi.fn().mockResolvedValue(fail({ error: UnitErrorCode.UNIT_SYSTEM_IMMUTABLE, msg: "immutable" })),
    }
    const app = mount(deleteUnitRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/units/${unitId}`, { method: "DELETE" })
    expect(res.status).toBe(400)
  })
})
