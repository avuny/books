import { beforeAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { InventoryTransferErrorCode } from "@avuny/contracts/inventory-transfer"
import {
  createTestApp,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

/**
 * Scope: authentication, tenancy, validation, list and unknown ids for every route.
 * The full draft, dispatch, receive journey needs a seeded catalog with stock and is covered by the
 * production run recorded in docs/modules/inventory-transfer/PROGRESS.md.
 */
describe("inventory-transfer routes (integration)", () => {
  let t: TestApp
  const nil = "00000000-0000-0000-0000-000000000000"
  const path = (orgId: string) => `/inventoryTransfer/organizations/${orgId}/inventory-transfers`

  beforeAll(async () => {
    t = await createTestApp()
  })

  it("rejects unauthenticated requests on every route", async () => {
    const base = path(nil)
    expectFailure(await t.anonymous.get(base), 401)
    expectFailure(await t.anonymous.post(base, { json: {} }), 401)
    for (const action of ["dispatch", "receive", "return", "close-short", "reverse", "cancel"]) {
      expectFailure(await t.anonymous.post(`${base}/${nil}/${action}`), 401)
    }
    expectFailure(await t.anonymous.post(`${base}/${nil}/receipts/${nil}/reverse`), 401)
  })

  it("lists an empty page", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const list = expectOk(await owner.api.get<{ items: unknown[] }>(path(org.id)), 200)
    expect(list.items).toEqual([])
  })

  it("returns 404 for unknown transfers on get and on each action", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = path(org.id)
    expectFailure(await owner.api.get(`${base}/${randomUUID()}`), 404, InventoryTransferErrorCode.INVENTORY_TRANSFER_NOT_FOUND)
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/dispatch`), 404, InventoryTransferErrorCode.INVENTORY_TRANSFER_NOT_FOUND)
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/return`), 404, InventoryTransferErrorCode.INVENTORY_TRANSFER_NOT_FOUND)
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/reverse`), 404, InventoryTransferErrorCode.INVENTORY_TRANSFER_NOT_FOUND)
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/close-short`), 404, InventoryTransferErrorCode.INVENTORY_TRANSFER_NOT_FOUND)
  })

  it("validates bodies with 422", async () => {
    const { owner, org } = await createUserWithOrganization(t.app)
    const base = path(org.id)
    expectFailure(await owner.api.post(base, { json: {} }), 422)
    expectFailure(
      await owner.api.post(base, {
        json: { date: "2026-11-26", sourceWarehouseId: randomUUID(), destinationWarehouseId: randomUUID(), lines: [] },
      }),
      422
    )
    expectFailure(await owner.api.post(`${base}/${randomUUID()}/receive`, { json: { lines: [] } }), 422)
  })

  it("does not expose another organization's data", async () => {
    const a = await createUserWithOrganization(t.app)
    const b = await createUserWithOrganization(t.app)
    const res = await b.owner.api.get(path(a.org.id))
    expect([403, 404]).toContain(res.status)
    expect(res.body?.success).toBe(false)
  })
})
