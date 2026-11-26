import { Hono, type MiddlewareHandler } from "hono"
import { describe, expect, it, vi } from "vitest"
import { fail, ok } from "@avuny/utils"
import { RoleErrorCode, WarehouseErrorCode } from "@avuny/contracts"
import { createWarehouseRoutes } from "../hono-routes/index.js"
import { ORG, WH_ID } from "../testing.js"

const ACTOR = "user-1"
const requireAuth: MiddlewareHandler = async (c, next) => {
  c.set("user", { id: ACTOR })
  await next()
}

const dto = {
  id: WH_ID,
  code: "WH-01",
  name: "Main",
  description: null,
  type: "physical",
  isDefault: true,
  isSystem: false,
  isActive: true,
  addressLine: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function build(service: Record<string, unknown>) {
  const app = new Hono()
  app.route("/", createWarehouseRoutes({ service: service as never, requireAuth }))
  return app
}
const post = (app: Hono, path: string, body?: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe("warehouse routes", () => {
  it("creates a warehouse (201) and passes the authenticated user as actor", async () => {
    const create = vi.fn().mockResolvedValue(ok({ data: dto, msg: "created" }))
    const res = await post(build({ create }), `/organizations/${ORG}/warehouses`, { code: "wh-01", name: "Main" })
    expect(res.status).toBe(201)
    expect(create).toHaveBeenCalledWith(
      ACTOR,
      ORG,
      expect.objectContaining({ code: "WH-01", type: "physical", createDefaultLocation: false })
    )
  })

  it("rejects an invalid body before reaching the service", async () => {
    const create = vi.fn()
    const res = await post(build({ create }), `/organizations/${ORG}/warehouses`, { code: "", name: "" })
    expect(res.status).toBe(422)
    expect(create).not.toHaveBeenCalled()
  })

  it("maps a permission denial to 403 and a taken code to 409", async () => {
    const denied = vi.fn().mockResolvedValue(fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "no" }))
    expect((await post(build({ create: denied }), `/organizations/${ORG}/warehouses`, { code: "A", name: "A" })).status).toBe(403)
    const taken = vi.fn().mockResolvedValue(fail({ error: WarehouseErrorCode.WAREHOUSE_CODE_TAKEN, msg: "taken" }))
    expect((await post(build({ create: taken }), `/organizations/${ORG}/warehouses`, { code: "A", name: "A" })).status).toBe(409)
  })

  it("maps not found to 404", async () => {
    const get = vi.fn().mockResolvedValue(fail({ error: WarehouseErrorCode.WAREHOUSE_NOT_FOUND, msg: "nf" }))
    const res = await build({ get }).request(`/organizations/${ORG}/warehouses/${WH_ID}`)
    expect(res.status).toBe(404)
  })

  it("serves the list (data table) and the options (combobox) endpoints", async () => {
    const list = vi.fn().mockResolvedValue(ok({ data: { items: [], page: 1, pageSize: 20, total: 0 }, msg: "ok" }))
    const listOptions = vi.fn().mockResolvedValue(ok({ data: { items: [], nextCursor: null }, msg: "ok" }))
    const app = build({ list, listOptions })
    expect((await app.request(`/organizations/${ORG}/warehouses?isActive=true&page=2`)).status).toBe(200)
    expect(list).toHaveBeenCalledWith(ACTOR, ORG, expect.objectContaining({ isActive: true, page: 2, pageSize: 20 }))
    expect((await app.request(`/organizations/${ORG}/warehouse-options?limit=5`)).status).toBe(200)
    expect(listOptions).toHaveBeenCalledWith(ACTOR, ORG, expect.objectContaining({ limit: 5 }))
  })
})
