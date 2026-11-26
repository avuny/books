import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import { PurchaseOrderErrorCode as Code, RoleErrorCode, type PurchaseOrderDto } from "@avuny/contracts"
import { cancelPurchaseOrderRoute } from "../hono-routes/cancel-purchase-order.route.js"
import { closePurchaseOrderRoute } from "../hono-routes/close-purchase-order.route.js"
import { confirmPurchaseOrderRoute } from "../hono-routes/confirm-purchase-order.route.js"
import { createPurchaseOrderRoute } from "../hono-routes/create-purchase-order.route.js"
import { deletePurchaseOrderRoute } from "../hono-routes/delete-purchase-order.route.js"
import { getPurchaseOrderRoute } from "../hono-routes/get-purchase-order.route.js"
import { listPurchaseOrdersRoute } from "../hono-routes/list-purchase-orders.route.js"
import { numberPreviewPurchaseOrderRoute } from "../hono-routes/number-preview-purchase-order.route.js"
import { createPurchaseOrderRoutes } from "../hono-routes/index.js"
import { updatePurchaseOrderRoute } from "../hono-routes/update-purchase-order.route.js"

const userId = "a0000000-0000-4000-a000-000000000001"
const orgId = "a0000000-0000-4000-a000-000000000002"
const poId = "a0000000-0000-4000-a000-000000000003"
const partyId = "a0000000-0000-4000-a000-000000000004"
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
const base = `/organizations/${orgId}/purchase-orders`
const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

const po: PurchaseOrderDto = {
  id: poId, number: "PO-000001", partyId, partyName: "Supplier", orderDate: "2026-11-26", expectedDeliveryDate: null,
  paymentTermId: null, paymentTermName: null, paymentTermMethod: null, paymentTermDays: null, currency: "EGP",
  warehouseId: null, supplierReference: null, notes: null, status: "DRAFT", subtotalAmount: "0", discountAmount: "0",
  taxAmount: "0", totalAmount: "0", closeReason: null, createdBy: userId, confirmedAt: null, confirmedBy: null, closedAt: null,
  cancelledAt: null, lines: [], createdAt: iso, updatedAt: iso,
}
const body = {
  partyId, orderDate: "2026-11-26",
  lines: [{ itemId, locationId, unitId, orderedQty: "2", unitPrice: "100" }],
}

describe("purchase-order routes", () => {
  it("previews the number (200) and is not read as an {id}", async () => {
    const service: any = {
      numberPreview: vi.fn().mockResolvedValue(ok({ data: { number: "PO-000001", today: "2026-11-26", currency: "EGP" } })),
      get: vi.fn(),
    }
    const app = mount(createPurchaseOrderRoutes({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`${base}/number-preview`)
    expect(res.status).toBe(200)
    expect(service.numberPreview).toHaveBeenCalledWith(userId, orgId)
    expect(service.get).not.toHaveBeenCalled()
  })

  it("lists with defaults (200)", async () => {
    const service: any = {
      list: vi.fn().mockResolvedValue(ok({ data: { items: [], page: 1, pageSize: 20, total: 0 } })),
    }
    const res = await mount(listPurchaseOrdersRoute({ service, requireAuth, requirePermission: allow })).request(base)
    expect(res.status).toBe(200)
    expect(service.list).toHaveBeenCalledWith(userId, orgId, expect.objectContaining({ page: 1, pageSize: 20 }))
  })

  it("creates (201)", async () => {
    const service: any = { create: vi.fn().mockResolvedValue(ok({ data: po })) }
    const res = await mount(createPurchaseOrderRoute({ service, requireAuth, requirePermission: allow })).request(base, json(body))
    expect(res.status).toBe(201)
    expect(service.create).toHaveBeenCalledWith(userId, orgId, expect.objectContaining({ partyId }))
  })

  it("rejects an invalid create body before the service (422)", async () => {
    const service: any = { create: vi.fn() }
    const res = await mount(createPurchaseOrderRoute({ service, requireAuth, requirePermission: allow })).request(
      base,
      json({ ...body, lines: [] })
    )
    expect(res.status).toBe(422)
    expect(service.create).not.toHaveBeenCalled()
  })

  it.each([
    [Code.PURCHASE_ORDER_PARTY_NOT_VENDOR, 422],
    [Code.PURCHASE_ORDER_DISCOUNT_EXCEEDS_LINE, 422],
    [Code.PURCHASE_ORDER_NUMBER_TAKEN, 409],
    [RoleErrorCode.ROLE_PERMISSION_DENIED, 403],
  ])("maps create failure %s to %i", async (error, status) => {
    const service: any = { create: vi.fn().mockResolvedValue(fail({ error, msg: "x" })) }
    const res = await mount(createPurchaseOrderRoute({ service, requireAuth, requirePermission: allow })).request(base, json(body))
    expect(res.status).toBe(status)
  })

  it("gets (200) and maps not found (404)", async () => {
    const service: any = { get: vi.fn().mockResolvedValue(ok({ data: po })) }
    const app = mount(getPurchaseOrderRoute({ service, requireAuth, requirePermission: allow }))
    expect((await app.request(`${base}/${poId}`)).status).toBe(200)
    service.get.mockResolvedValue(fail({ error: Code.PURCHASE_ORDER_NOT_FOUND, msg: "x" }))
    expect((await app.request(`${base}/${poId}`)).status).toBe(404)
  })

  it("updates (200) and maps not editable (409)", async () => {
    const service: any = { update: vi.fn().mockResolvedValue(ok({ data: po })) }
    const app = mount(updatePurchaseOrderRoute({ service, requireAuth, requirePermission: allow }))
    const patch = { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes: "n" }) }
    expect((await app.request(`${base}/${poId}`, patch)).status).toBe(200)
    service.update.mockResolvedValue(fail({ error: Code.PURCHASE_ORDER_NOT_EDITABLE, msg: "x" }))
    expect((await app.request(`${base}/${poId}`, patch)).status).toBe(409)
  })

  it("deletes (200) and maps not deletable (409)", async () => {
    const service: any = { delete: vi.fn().mockResolvedValue(ok({ data: { id: poId } })) }
    const app = mount(deletePurchaseOrderRoute({ service, requireAuth, requirePermission: allow }))
    expect((await app.request(`${base}/${poId}`, { method: "DELETE" })).status).toBe(200)
    service.delete.mockResolvedValue(fail({ error: Code.PURCHASE_ORDER_NOT_DELETABLE, msg: "x" }))
    expect((await app.request(`${base}/${poId}`, { method: "DELETE" })).status).toBe(409)
  })

  it("confirms (200) and maps validation (422) and already confirmed (409)", async () => {
    const service: any = { confirm: vi.fn().mockResolvedValue(ok({ data: { ...po, status: "CONFIRMED" } })) }
    const app = mount(confirmPurchaseOrderRoute({ service, requireAuth, requirePermission: allow }))
    const req = { method: "POST" }
    expect((await app.request(`${base}/${poId}/confirm`, req)).status).toBe(200)
    service.confirm.mockResolvedValue(fail({ error: Code.PURCHASE_ORDER_ITEM_INACTIVE, msg: "x" }))
    expect((await app.request(`${base}/${poId}/confirm`, req)).status).toBe(422)
    service.confirm.mockResolvedValue(fail({ error: Code.PURCHASE_ORDER_ALREADY_CONFIRMED, msg: "x" }))
    expect((await app.request(`${base}/${poId}/confirm`, req)).status).toBe(409)
  })

  it("closes with a reason (200) and requires one (422)", async () => {
    const service: any = { close: vi.fn().mockResolvedValue(ok({ data: { ...po, status: "CLOSED" } })) }
    const app = mount(closePurchaseOrderRoute({ service, requireAuth, requirePermission: allow }))
    expect((await app.request(`${base}/${poId}/close`, json({ reason: "Supplier short" }))).status).toBe(200)
    expect(service.close).toHaveBeenCalledWith(userId, orgId, poId, { reason: "Supplier short" })
    expect((await app.request(`${base}/${poId}/close`, json({}))).status).toBe(422)
  })

  it("cancels (200) and maps has-fulfillment (409)", async () => {
    const service: any = { cancel: vi.fn().mockResolvedValue(ok({ data: { ...po, status: "CANCELLED" } })) }
    const app = mount(cancelPurchaseOrderRoute({ service, requireAuth, requirePermission: allow }))
    expect((await app.request(`${base}/${poId}/cancel`, json({}))).status).toBe(200)
    service.cancel.mockResolvedValue(fail({ error: Code.PURCHASE_ORDER_HAS_FULFILLMENT, msg: "x" }))
    expect((await app.request(`${base}/${poId}/cancel`, json({}))).status).toBe(409)
  })
})
