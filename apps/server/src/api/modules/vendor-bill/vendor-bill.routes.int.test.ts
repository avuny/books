import { beforeAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import type { VendorBillListResponse } from "@avuny/contracts/vendor-bill"
import { VendorBillErrorCode } from "@avuny/contracts/vendor-bill"
import {
  createTestApp,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

/**
 * Scope: authentication, tenancy, validation, list and unknown ids.
 * The full receipt -> bill -> post -> reverse journey needs a seeded catalog and is covered by the
 * production smoke run recorded in docs/modules/vendor-bill-payment/PROGRESS.md (and open in TEST-PLAN.md).
 */
describe("vendor-bill routes (integration)", () => {
  let t: TestApp
  const nil = "00000000-0000-0000-0000-000000000000"

  beforeAll(async () => {
    t = await createTestApp()
  })

  it("rejects unauthenticated requests", async () => {
    const base = `/vendorBill/organizations/${nil}/vendor-bills`
    expectFailure(await t.anonymous.get(base), 401)
    expectFailure(await t.anonymous.post(base, { json: {} }), 401)
    expectFailure(await t.anonymous.post(`${base}/${nil}/post`), 401)
  })

  it("lists an empty page", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const list = expectOk(await owner.api.get<VendorBillListResponse>(`/vendorBill/organizations/${org.id}/vendor-bills`), 200)
    expect(list.items).toEqual([])
  })

  it("returns 404 for an unknown bill and an unknown receipt", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/vendorBill/organizations/${org.id}/vendor-bills`
    expectFailure(await owner.api.get(`${base}/${randomUUID()}`), 404, VendorBillErrorCode.VENDOR_BILL_NOT_FOUND)
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/post`), 404, VendorBillErrorCode.VENDOR_BILL_NOT_FOUND)
    expectFailure(
      await owner.api.post(`${base}/from-receipt`, { json: { purchaseReceiptId: randomUUID(), invoiceDate: "2026-11-26" } }),
      404,
      VendorBillErrorCode.VENDOR_BILL_RECEIPT_NOT_FOUND
    )
  })

  it("validates create bodies with 422", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/vendorBill/organizations/${org.id}/vendor-bills`
    expectFailure(await owner.api.post(base, { json: {} }), 422)
    expectFailure(await owner.api.post(base, { json: { partyId: randomUUID(), invoiceDate: "2026-11-26", lines: [] } }), 422)
    expectFailure(await owner.api.post(base, { json: { partyId: "nope", invoiceDate: "26/11/2026", lines: [] } }), 422)
  })

  it("does not expose another organization's data", async () => {
    const a = await createUserWithOrganization(t.app)
    const b = await createUserWithOrganization(t.app)
    const res = await b.owner.api.get(`/vendorBill/organizations/${a.org.id}/vendor-bills`)
    expect([403, 404]).toContain(res.status)
    expect(res.body?.success).toBe(false)
  })
  it("serves empty AP reports and protects them", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/vendorBill/organizations/${org.id}/ap-reports`
    expectFailure(await t.anonymous.get(`${base}/aging`), 401)
    const aging = expectOk(await owner.api.get<{ rows: unknown[] }>(`${base}/aging`), 200)
    expect(aging.rows).toEqual([])
    const rec = expectOk(
      await owner.api.get<{ accountsPayable: { balanced: boolean }; goodsReceivedNotInvoiced: { balanced: boolean } }>(`${base}/reconciliation`),
      200
    )
    expect(rec.accountsPayable.balanced).toBe(true)
    expect(rec.goodsReceivedNotInvoiced.balanced).toBe(true)
    expectFailure(
      await owner.api.get(`${base}/supplier-statement?partyId=${randomUUID()}`),
      404,
      VendorBillErrorCode.VENDOR_BILL_SUPPLIER_NOT_FOUND
    )
    expectFailure(await owner.api.get(`${base}/supplier-statement?partyId=nope`), 422)
  })
})
