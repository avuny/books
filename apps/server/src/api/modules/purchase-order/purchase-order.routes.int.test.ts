import { beforeAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import type {
  PurchaseOrderNumberPreviewDto,
  PurchaseOrderOffsetListResponse,
} from "@avuny/contracts/purchase-order"
import { PurchaseOrderErrorCode } from "@avuny/contracts/purchase-order"
import {
  createTestApp,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

/**
 * Scope: authentication, tenancy, validation, list and number preview.
 * The full draft -> confirm -> ship -> receive journey needs a seeded catalog
 * (warehouse, location, item, vendor) and is tracked as open in
 * docs/modules/purchase-order/TEST-PLAN.md.
 */
describe("purchase-order routes (integration)", () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  const nil = "00000000-0000-0000-0000-000000000000"

  it("rejects unauthenticated requests", async () => {
    const base = `/purchaseOrder/organizations/${nil}/purchase-orders`
    expectFailure(await t.anonymous.get(base), 401)
    expectFailure(await t.anonymous.post(base, { json: {} }), 401)
    expectFailure(await t.anonymous.post(`${base}/${nil}/confirm`), 401)
  })

  it("lists an empty page and previews the next number (fixed path is not read as an id)", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/purchaseOrder/organizations/${org.id}/purchase-orders`

    const list = expectOk(
      await owner.api.get<PurchaseOrderOffsetListResponse>(base, { query: { page: 1, pageSize: 20 } }),
      200
    )
    expect(list).toMatchObject({ items: [], total: 0, page: 1 })

    const preview = expectOk(await owner.api.get<PurchaseOrderNumberPreviewDto>(`${base}/number-preview`), 200)
    expect(preview.number).toMatch(/^PO-/)
    expect(preview.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(preview.currency.length).toBeGreaterThan(0)
  })

  it("returns 404 for an unknown order", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/purchaseOrder/organizations/${org.id}/purchase-orders`
    expectFailure(await owner.api.get(`${base}/${randomUUID()}`), 404, PurchaseOrderErrorCode.PURCHASE_ORDER_NOT_FOUND)
    expectFailure(
      await owner.api.post(`${base}/${randomUUID()}/confirm`),
      404,
      PurchaseOrderErrorCode.PURCHASE_ORDER_NOT_FOUND
    )
  })

  it("validates create bodies with 422 (no lines, bad ids, bad date)", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/purchaseOrder/organizations/${org.id}/purchase-orders`
    expectFailure(await owner.api.post(base, { json: {} }), 422)
    expectFailure(
      await owner.api.post(base, { json: { partyId: randomUUID(), orderDate: "2026-11-26", lines: [] } }),
      422
    )
    expectFailure(
      await owner.api.post(base, { json: { partyId: "nope", orderDate: "26/11/2026", lines: [] } }),
      422
    )
  })

  it("does not expose another organization's data", async () => {
    const a = await createUserWithOrganization(t.app)
    const b = await createUserWithOrganization(t.app)
    // b's owner is not a member of a's organization.
    const res = await b.owner.api.get(`/purchaseOrder/organizations/${a.org.id}/purchase-orders`)
    expect([403, 404]).toContain(res.status)
    expect(res.body?.success).toBe(false)
  })
})
