import { Hono, type MiddlewareHandler } from "hono"
import { describe, expect, it, vi } from "vitest"
import { fail, ok } from "@avuny/utils"
import { RoleErrorCode, WarehouseLocationErrorCode as E } from "@avuny/contracts"
import { createWarehouseLocationRoutes } from "../hono-routes/index.js"
import { ORG, WH_ID, ids } from "../testing.js"

const ACTOR = "user-1"
const requireAuth: MiddlewareHandler = async (c, next) => {
  c.set("user", { id: ACTOR })
  await next()
}

const dto = {
  id: ids.bin,
  warehouseId: WH_ID,
  parentId: null,
  code: "BIN-01",
  fullCode: "BIN-01",
  name: "BIN-01",
  type: "bin",
  purpose: "storage",
  treeDepth: 0,
  barcode: "LOC-AAAAAAAAAAAA",
  sortOrder: 0,
  isStockable: true,
  isPickable: true,
  isReceivable: true,
  isActive: true,
  isBlocked: false,
  blockedReason: null,
  blockedAt: null,
  effectiveIsBlocked: false,
  hasChildren: false,
  width: null,
  height: null,
  depth: null,
  maxWeight: null,
  maxVolume: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function build(service: Record<string, unknown>) {
  const app = new Hono()
  app.route("/", createWarehouseLocationRoutes({ service: service as never, requireAuth }))
  return app
}
const send = (app: Hono, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe("warehouse location routes", () => {
  it("creates a location (201) under a warehouse", async () => {
    const create = vi.fn().mockResolvedValue(ok({ data: dto, msg: "created" }))
    const res = await send(build({ create }), "POST", `/organizations/${ORG}/warehouses/${WH_ID}/locations`, {
      code: "bin-01",
      type: "bin",
    })
    expect(res.status).toBe(201)
    expect(create).toHaveBeenCalledWith(ACTOR, ORG, WH_ID, expect.objectContaining({ code: "BIN-01", sortOrder: 0 }))
  })

  it("maps domain errors to their HTTP status", async () => {
    const cases: [E, number][] = [
      [E.WAREHOUSE_LOCATION_NOT_FOUND, 404],
      [E.WAREHOUSE_LOCATION_CODE_TAKEN, 409],
      [E.WAREHOUSE_LOCATION_CYCLE_DETECTED, 422],
    ]
    for (const [error, status] of cases) {
      const move = vi.fn().mockResolvedValue(fail({ error, msg: "x" }))
      const res = await send(build({ move }), "POST", `/organizations/${ORG}/locations/${ids.bin}/move`, { parentId: null })
      expect(res.status).toBe(status)
    }
    const denied = vi.fn().mockResolvedValue(fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "no" }))
    const res = await send(build({ move: denied }), "POST", `/organizations/${ORG}/locations/${ids.bin}/move`, { parentId: null })
    expect(res.status).toBe(403)
  })

  it("serves /locations/lookup before the parametric /locations/{id}", async () => {
    const lookup = vi.fn().mockResolvedValue(ok({ data: { ...dto, path: [], warehouse: { id: WH_ID, code: "WH-01", name: "Main", type: "physical", isActive: true } }, msg: "ok" }))
    const get = vi.fn()
    const res = await build({ lookup, get }).request(`/organizations/${ORG}/locations/lookup?barcode=LOC-AAAAAAAAAAAA`)
    expect(res.status).toBe(200)
    expect(lookup).toHaveBeenCalledWith(ACTOR, ORG, { barcode: "LOC-AAAAAAAAAAAA" })
    expect(get).not.toHaveBeenCalled()
  })

  it("rejects a lookup with neither barcode nor warehouse + full code", async () => {
    const lookup = vi.fn()
    const res = await build({ lookup }).request(`/organizations/${ORG}/locations/lookup`)
    expect(res.status).toBe(422)
    expect(lookup).not.toHaveBeenCalled()
  })

  it("turns the cascade query flag into a boolean", async () => {
    const deactivate = vi.fn().mockResolvedValue(ok({ data: dto, msg: "ok" }))
    await send(build({ deactivate }), "POST", `/organizations/${ORG}/locations/${ids.bin}/deactivate?cascade=true`)
    expect(deactivate).toHaveBeenCalledWith(ACTOR, ORG, ids.bin, { cascade: true })
  })

  it("serves the list (data table) and options (combobox) endpoints", async () => {
    const list = vi.fn().mockResolvedValue(ok({ data: { items: [], page: 1, pageSize: 20, total: 0 }, msg: "ok" }))
    const listOptions = vi.fn().mockResolvedValue(ok({ data: { items: [], nextCursor: null }, msg: "ok" }))
    const app = build({ list, listOptions })
    expect((await app.request(`/organizations/${ORG}/locations?usable=true&type=bin`)).status).toBe(200)
    expect(list).toHaveBeenCalledWith(ACTOR, ORG, expect.objectContaining({ usable: true, type: "bin" }))
    expect((await app.request(`/organizations/${ORG}/location-options?warehouseId=${WH_ID}`)).status).toBe(200)
  })
})
