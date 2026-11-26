import { beforeAll, describe, expect, it } from "vitest"
import type { PaymentTermDto, PaymentTermListResponse } from "@avuny/contracts/payment-term"
import { PaymentTermErrorCode } from "@avuny/contracts/payment-term"
import {
  createTestApp,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

describe("payment-term routes (integration)", () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  it("rejects unauthenticated requests", async () => {
    const base = "/paymentTerm/organizations/00000000-0000-0000-0000-000000000000/payment-terms"
    expectFailure(await t.anonymous.get(base), 401)
    expectFailure(await t.anonymous.post(base, { json: {} }), 401)
  })

  it("seeds system terms lazily, then creates, renames and rejects duplicates and system edits", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = `/paymentTerm/organizations/${org.id}/payment-terms`

    const list = expectOk(await owner.api.get<PaymentTermListResponse>(base), 200)
    expect(list.items.length).toBeGreaterThan(0)
    expect(list.items.every((p) => p.isSystem)).toBe(true)
    const system = list.items[0]!

    const created = expectOk(
      await owner.api.post<PaymentTermDto>(base, { json: { name: "Net 45", method: "NET_DAYS", days: 45 } }),
      201
    )
    expect(created).toMatchObject({ name: "Net 45", days: 45, isSystem: false, isActive: true })
    expect(created.code.startsWith("CUSTOM_")).toBe(true)

    expectFailure(
      await owner.api.post(base, { json: { name: "Net 45", method: "NET_DAYS", days: 45 } }),
      409,
      PaymentTermErrorCode.PAYMENT_TERM_NAME_TAKEN
    )

    const renamed = expectOk(
      await owner.api.patch<PaymentTermDto>(`${base}/${created.id}`, { json: { name: "Net 45 days" } }),
      200
    )
    expect(renamed.name).toBe("Net 45 days")

    expectFailure(
      await owner.api.patch(`${base}/${system.id}`, { json: { name: "Renamed" } }),
      409,
      PaymentTermErrorCode.PAYMENT_TERM_SYSTEM_READONLY
    )
  })

  it("does not leak terms across organizations", async () => {
    const a = await createUserWithOrganization(t.app)
    const b = await createUserWithOrganization(t.app)
    const created = expectOk(
      await a.owner.api.post<PaymentTermDto>(`/paymentTerm/organizations/${a.org.id}/payment-terms`, {
        json: { name: "Only for A", method: "NET_DAYS", days: 10 },
      }),
      201
    )
    const res = await b.owner.api.patch(`/paymentTerm/organizations/${b.org.id}/payment-terms/${created.id}`, {
      json: { name: "Hijack" },
    })
    expectFailure(res, 404, PaymentTermErrorCode.PAYMENT_TERM_NOT_FOUND)
  })

  it("validates the body with 422", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    expectFailure(
      await owner.api.post(`/paymentTerm/organizations/${org.id}/payment-terms`, { json: { name: "" } }),
      422
    )
  })
})
