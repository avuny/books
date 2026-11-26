import { beforeAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import type { VendorPaymentListResponse } from "@avuny/contracts/vendor-payment"
import { VendorPaymentErrorCode } from "@avuny/contracts/vendor-payment"
import {
  createTestApp,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

/**
 * Scope: authentication, tenancy, validation, list and unknown ids.
 * The full bill -> payment -> post -> reverse journey needs a seeded catalog and is covered by the
 * production smoke run recorded in docs/modules/vendor-payment-payment/PROGRESS.md (and open in TEST-PLAN.md).
 */
describe("vendor-payment routes (integration)", () => {
  let t: TestApp
  const nil = "00000000-0000-0000-0000-000000000000"

  beforeAll(async () => {
    t = await createTestApp()
  })

  it("rejects unauthenticated requests", async () => {
    const base = `/vendorPayment/organizations/${nil}/vendor-payments`
    expectFailure(await t.anonymous.get(base), 401)
    expectFailure(await t.anonymous.post(base, { json: {} }), 401)
    expectFailure(await t.anonymous.post(`${base}/${nil}/post`), 401)
  })

  it("lists an empty page", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const list = expectOk(await owner.api.get<VendorPaymentListResponse>(`/vendorPayment/organizations/${org.id}/vendor-payments`), 200)
    expect(list.items).toEqual([])
  })

  it("returns 404 for an unknown payment", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/vendorPayment/organizations/${org.id}/vendor-payments`
    expectFailure(await owner.api.get(`${base}/${randomUUID()}`), 404, VendorPaymentErrorCode.VENDOR_PAYMENT_NOT_FOUND)
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/post`), 404, VendorPaymentErrorCode.VENDOR_PAYMENT_NOT_FOUND)
  })

  it("validates create bodies with 422", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/vendorPayment/organizations/${org.id}/vendor-payments`
    expectFailure(await owner.api.post(base, { json: {} }), 422)
    expectFailure(await owner.api.post(base, { json: { partyId: randomUUID(), paymentDate: "2026-11-26", method: "bank", allocations: [] } }), 422)
    expectFailure(await owner.api.post(base, { json: { partyId: "nope", paymentDate: "26/11/2026", method: "bank", allocations: [] } }), 422)
  })

  it("does not expose another organization's data", async () => {
    const a = await createUserWithOrganization(t.app)
    const b = await createUserWithOrganization(t.app)
    const res = await b.owner.api.get(`/vendorPayment/organizations/${a.org.id}/vendor-payments`)
    expect([403, 404]).toContain(res.status)
    expect(res.body?.success).toBe(false)
  })
})
