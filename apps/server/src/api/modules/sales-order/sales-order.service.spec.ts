import { beforeEach, describe, expect, it } from "vitest"
import { SalesOrderErrorCode as Err, RoleErrorCode, type CreateSalesOrderInput } from "@avuny/contracts"
import { createSalesOrderService } from "./sales-order.service.js"
import {
  FakeReservations,
  InMemorySalesOrderRepository,
  allowAll,
  denyAll,
  noopActivityLog,
  okItems,
  okLocations,
  okOrgSettings,
  okCustomers,
  okTerms,
} from "./testing.js"

const orgId = "11111111-1111-4111-a111-111111111111"
const actorId = "22222222-2222-4222-a222-222222222222"
const partyId = "33333333-3333-4333-a333-333333333333"
const warehouseId = "44444444-4444-4444-a444-444444444444"
const locationId = "55555555-5555-4555-a555-555555555555"
const itemA = "66666666-6666-4666-a666-666666666666"
const itemB = "77777777-7777-4777-a777-777777777777"

const line = (over: Record<string, unknown> = {}) => ({
  itemId: itemA,
  locationId,
  unitId: "pc",
  orderedQty: "10",
  unitPrice: "2500",
  discountAmount: "0",
  discountRateBps: 0,
  taxRateBps: 0,
  ...over,
})

const input = (over: Partial<CreateSalesOrderInput> = {}) =>
  ({
    partyId,
    orderDate: "2026-11-26",
    warehouseId,
    lines: [line()],
    ...over,
  }) as CreateSalesOrderInput

describe("SalesOrderService", () => {
  let repo: InMemorySalesOrderRepository
  let reservations: FakeReservations
  let overrides: Partial<Parameters<typeof createSalesOrderService>[0]>
  const make = () =>
    createSalesOrderService({
      repository: repo,
      items: okItems,
      locations: okLocations,
      customers: okCustomers,
      paymentTerms: okTerms,
      orgSettings: okOrgSettings,
      reservations,
      permissions: allowAll,
      activityLog: noopActivityLog,
      ...overrides,
    })

  beforeEach(() => {
    repo = new InMemorySalesOrderRepository()
    reservations = new FakeReservations()
    reservations.stock.set(itemA, 1000)
    reservations.stock.set(itemB, 1000)
    overrides = {}
  })

  const createDraft = async (over: Partial<CreateSalesOrderInput> = {}) => {
    const res = await make().create(actorId, orgId, input(over))
    if (!res.success) throw new Error(`create failed: ${res.error}`)
    return res.data
  }

  describe("create", () => {
    it("creates a draft with computed amounts, base quantities and the default payment term", async () => {
      const po = await createDraft({ lines: [line({ unitId: "box", orderedQty: "2", unitPrice: "1000", discountAmount: "500" })] })
      expect(po.number).toBe("SO-000001")
      expect(po.status).toBe("DRAFT")
      expect(po.currency).toBe("EGP")
      expect(po.paymentTermName).toBe("Due on receipt")
      expect(po.lines[0]).toMatchObject({ orderedBaseQty: "24", lineNetAmount: "1500", discountAmount: "500" })
      expect(po).toMatchObject({ subtotalAmount: "2000", discountAmount: "500", totalAmount: "1500" })
      expect(reservations.inputs).toHaveLength(0)
    })

    it("numbers sequentially and retries when a number is taken", async () => {
      await createDraft()
      repo.takenSuffixes.add(2)
      const second = await createDraft()
      expect(second.number).toBe("SO-000003")
    })

    it("rejects a caller without permission", async () => {
      overrides = { permissions: denyAll }
      const res = await make().create(actorId, orgId, input())
      expect(res).toMatchObject({ success: false, error: RoleErrorCode.ROLE_PERMISSION_DENIED })
    })

    it("rejects a party that is not an active customer", async () => {
      overrides = { customers: { assertActiveCustomer: async () => ({ ok: false, reason: "party_not_customer" }) } }
      expect(await make().create(actorId, orgId, input())).toMatchObject({ error: Err.SALES_ORDER_PARTY_NOT_CUSTOMER })
    })

    it("rejects a discount larger than the line gross", async () => {
      const res = await make().create(actorId, orgId, input({ lines: [line({ unitPrice: "100", orderedQty: "1", discountAmount: "101" })] }))
      expect(res).toMatchObject({ error: Err.SALES_ORDER_DISCOUNT_EXCEEDS_LINE })
    })

    it("rejects a line that has both a discount rate and a discount amount", async () => {
      const res = await make().create(actorId, orgId, input({ lines: [line({ discountRateBps: 1000, discountAmount: "5" })] }))
      expect(res).toMatchObject({ error: Err.SALES_ORDER_DISCOUNT_CONFLICT })
    })

    it("applies a discount rate then tax per line and totals them on the header", async () => {
      // line 1: 10 x 2500 = 25000 gross; 10% off = 2500; net 22500; 14% tax = 3150; total 25650
      // line 2: 3 x 333 = 999 gross; no discount; 5% tax = 49.95 -> 50; total 1049
      const po = await createDraft({
        lines: [
          line({ discountRateBps: 1000, taxRateBps: 1400 }),
          line({ itemId: itemB, orderedQty: "3", unitPrice: "333", taxRateBps: 500 }),
        ],
      })
      expect(po.lines[0]).toMatchObject({
        discountRateBps: 1000,
        taxRateBps: 1400,
        discountAmount: "2500",
        lineNetAmount: "22500",
        taxAmount: "3150",
        lineTotalAmount: "25650",
      })
      expect(po.lines[1]).toMatchObject({ lineNetAmount: "999", taxAmount: "50", lineTotalAmount: "1049" })
      expect(po).toMatchObject({
        subtotalAmount: "25999",
        discountAmount: "2500",
        taxAmount: "3200",
        totalAmount: "26699",
      })
    })

    it("recomputes tax and totals when lines are replaced on update", async () => {
      const svc = make()
      const po = await createDraft({ lines: [line({ taxRateBps: 1000 })] })
      const res = await svc.update(actorId, orgId, po.id, { lines: [line({ unitPrice: "1000", taxRateBps: 2000 })] })
      expect(res.success && res.data).toMatchObject({ subtotalAmount: "10000", taxAmount: "2000", totalAmount: "12000" })
    })

    it("requires a warehouse on the header or the line", async () => {
      const res = await make().create(actorId, orgId, input({ warehouseId: null }))
      expect(res).toMatchObject({ error: Err.SALES_ORDER_WAREHOUSE_REQUIRED })
    })

    it("maps location and item failures to sales order codes", async () => {
      overrides = { locations: { validate: async () => ({ ok: false, reason: "location_blocked" }) } }
      expect(await make().create(actorId, orgId, input())).toMatchObject({ error: Err.SALES_ORDER_LOCATION_BLOCKED })
      overrides = { items: { resolve: async () => ({ ok: false, reason: "item_inactive" }) } }
      expect(await make().create(actorId, orgId, input())).toMatchObject({ error: Err.SALES_ORDER_ITEM_INACTIVE })
    })

    it("rejects an inactive payment term", async () => {
      overrides = { paymentTerms: { ...okTerms, get: async () => ({ ...(await okTerms.get("", "")!)!, isActive: false }) } }
      const res = await make().create(actorId, orgId, input({ paymentTermId: "10000000-0000-4000-a000-000000000001" }))
      expect(res).toMatchObject({ error: Err.SALES_ORDER_PAYMENT_TERM_INACTIVE })
    })
  })

  describe("update and delete", () => {
    it("replaces lines and recomputes totals on a draft", async () => {
      const po = await createDraft()
      const res = await make().update(actorId, orgId, po.id, { lines: [line({ orderedQty: "1", unitPrice: "700" })] })
      expect(res.success && res.data.totalAmount).toBe("700")
      expect(res.success && res.data.lines).toHaveLength(1)
    })

    it("refuses to edit or delete a confirmed order", async () => {
      const po = await createDraft()
      await make().confirm(actorId, orgId, po.id)
      expect(await make().update(actorId, orgId, po.id, { notes: "x" })).toMatchObject({ error: Err.SALES_ORDER_NOT_EDITABLE })
      expect(await make().delete(actorId, orgId, po.id)).toMatchObject({ error: Err.SALES_ORDER_NOT_DELETABLE })
    })

    it("deletes a draft", async () => {
      const po = await createDraft()
      expect((await make().delete(actorId, orgId, po.id)).success).toBe(true)
      expect(await make().get(actorId, orgId, po.id)).toMatchObject({ error: Err.SALES_ORDER_NOT_FOUND })
    })
  })

  describe("confirm", () => {
    it("confirms and reserves the ordered base quantity", async () => {
      const so = await createDraft({ lines: [line({ unitId: "box", orderedQty: "2" })] })
      const res = await make().confirm(actorId, orgId, so.id)
      expect(res.success && res.data.status).toBe("CONFIRMED")
      expect(res.success && res.data.lines[0]).toMatchObject({ reservedBaseQty: "24", openToDeliverBaseQty: "24", unreservedOpenBaseQty: "0" })
      expect(reservations.inputs[0]).toMatchObject({ sourceType: "SALES_ORDER", policy: "REQUIRE_FULL_RESERVATION" })
    })

    it("refuses to confirm when stock is short under the default policy and leaves the draft intact", async () => {
      reservations.stock.set(itemA, 4)
      const so = await createDraft({ lines: [line({ orderedQty: "10" })] })
      expect(await make().confirm(actorId, orgId, so.id)).toMatchObject({ error: Err.SALES_ORDER_INSUFFICIENT_STOCK })
      const after = await make().get(actorId, orgId, so.id)
      expect(after.success && after.data.status).toBe("DRAFT")
    })

    it("reserves what exists and leaves a backorder under ALLOW_PARTIAL_RESERVATION", async () => {
      reservations.stock.set(itemA, 4)
      const so = await createDraft({ lines: [line({ orderedQty: "10" })] })
      const res = await make().confirm(actorId, orgId, so.id, { policy: "ALLOW_PARTIAL_RESERVATION" })
      expect(res.success && res.data.lines[0]).toMatchObject({ reservedBaseQty: "4", unreservedOpenBaseQty: "6" })
    })

    it("requires some stock on every line under ALLOW_PARTIAL_RESERVATION", async () => {
      reservations.stock.set(itemB, 0)
      const so = await createDraft({ lines: [line(), line({ itemId: itemB })] })
      expect(await make().confirm(actorId, orgId, so.id, { policy: "ALLOW_PARTIAL_RESERVATION" })).toMatchObject({
        error: Err.SALES_ORDER_INSUFFICIENT_STOCK,
      })
    })

    it("confirms with no stock at all under ALLOW_BACKORDER_WITHOUT_RESERVATION", async () => {
      reservations.stock.set(itemA, 0)
      const so = await createDraft()
      const res = await make().confirm(actorId, orgId, so.id, { policy: "ALLOW_BACKORDER_WITHOUT_RESERVATION" })
      expect(res.success && res.data.lines[0]).toMatchObject({ reservedBaseQty: "0", unreservedOpenBaseQty: "10" })
    })

    it("cannot confirm twice", async () => {
      const so = await createDraft()
      await make().confirm(actorId, orgId, so.id)
      expect(await make().confirm(actorId, orgId, so.id)).toMatchObject({ error: Err.SALES_ORDER_ALREADY_CONFIRMED })
    })

    it("re-validates the customer at confirmation", async () => {
      const so = await createDraft()
      overrides = { customers: { assertActiveCustomer: async () => ({ ok: false, reason: "party_inactive" }) } }
      expect(await make().confirm(actorId, orgId, so.id)).toMatchObject({ error: Err.SALES_ORDER_PARTY_INACTIVE })
      expect(reservations.inputs).toHaveLength(0)
    })

    it("requires permission", async () => {
      const so = await createDraft()
      overrides = { permissions: denyAll }
      expect(await make().confirm(actorId, orgId, so.id)).toMatchObject({ error: RoleErrorCode.ROLE_PERMISSION_DENIED })
    })
  })

  describe("close", () => {
    it("releases the reservation and cancels the undelivered quantity", async () => {
      const so = await createDraft({ lines: [line({ orderedQty: "10" })] })
      await make().confirm(actorId, orgId, so.id)
      repo.lines[0]!.deliveredBaseQty = "4"
      const res = await make().close(actorId, orgId, so.id, { reason: "Customer short" })
      expect(res.success && res.data.status).toBe("CLOSED")
      expect(repo.lines[0]).toMatchObject({ cancelledBaseQty: "6", reservedBaseQty: "0" })
      expect(reservations.releases).toEqual([so.id])
    })

    it("rejects drafts and already closed orders", async () => {
      const so = await createDraft()
      expect(await make().close(actorId, orgId, so.id, { reason: "x" })).toMatchObject({ error: Err.SALES_ORDER_NOT_OPEN })
      await make().confirm(actorId, orgId, so.id)
      await make().close(actorId, orgId, so.id, { reason: "x" })
      expect(await make().close(actorId, orgId, so.id, { reason: "x" })).toMatchObject({ error: Err.SALES_ORDER_ALREADY_CLOSED })
    })
  })

  describe("cancel", () => {
    it("cancels a draft without touching reservations", async () => {
      const so = await createDraft()
      const res = await make().cancel(actorId, orgId, so.id, {})
      expect(res.success && res.data.status).toBe("CANCELLED")
      expect(reservations.releases).toHaveLength(0)
    })

    it("cancels an untouched confirmed order and releases everything", async () => {
      const so = await createDraft({ lines: [line({ orderedQty: "5" }), line({ itemId: itemB, orderedQty: "3" })] })
      await make().confirm(actorId, orgId, so.id)
      await make().cancel(actorId, orgId, so.id, { reason: "Duplicate" })
      expect(reservations.releases).toEqual([so.id])
      expect(repo.lines.every((l) => l.reservedBaseQty === "0" && l.cancelledBaseQty === l.orderedBaseQty)).toBe(true)
    })

    it("refuses once something was delivered", async () => {
      const so = await createDraft()
      await make().confirm(actorId, orgId, so.id)
      repo.deliveredOrderIds.add(so.id)
      expect(await make().cancel(actorId, orgId, so.id, {})).toMatchObject({ error: Err.SALES_ORDER_HAS_FULFILLMENT })
    })
  })

  describe("preview and list", () => {
    it("previews the next number with the organization-local date", async () => {
      await createDraft()
      const res = await make().numberPreview(actorId, orgId)
      expect(res.success && res.data).toMatchObject({ number: "SO-000002", currency: "EGP" })
      expect(res.success && res.data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it("lists with pagination and a status filter", async () => {
      const a = await createDraft()
      await createDraft()
      await make().confirm(actorId, orgId, a.id)
      const res = await make().list(actorId, orgId, { page: 1, pageSize: 10, status: "CONFIRMED" })
      expect(res.success && res.data).toMatchObject({ total: 1, page: 1 })
    })
  })
})
