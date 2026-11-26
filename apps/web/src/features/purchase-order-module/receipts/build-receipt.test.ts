import { describe, expect, it } from "vitest"

import type { PurchaseOrderDto } from "../types"
import { buildReceiptPayload, openReceiptLines } from "./build-receipt"

const line = (id: string, inTransit: string, unshipped: string) =>
  ({ id, unitId: "00000000-0000-4000-8000-0000000000a1", locationId: "00000000-0000-4000-8000-0000000000b1", inTransitBaseQty: inTransit, unshippedBaseQty: unshipped }) as never
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const open = [line(uuid(1), "6", "0"), line(uuid(2), "0", "4")] as never[]

describe("openReceiptLines", () => {
  it("keeps lines with something in transit or not shipped", () => {
    const order = { lines: [line("a", "0", "0"), line("b", "3", "0"), line("c", "0", "2")] } as unknown as PurchaseOrderDto
    expect(openReceiptLines(order).map((l) => l.id)).toEqual(["b", "c"])
  })
})

describe("buildReceiptPayload", () => {
  const header = { date: "", reference: " ref ", notes: "" }
  it("skips blank lines, derives accepted and defaults the date", () => {
    const res = buildReceiptPayload(header, open, { [uuid(1)]: { received: "5", rejected: "2", reason: "damaged", direct: false } }, "2026-11-28")
    expect(res.ok && res.data).toMatchObject({
      receiptDate: "2026-11-28",
      supplierDeliveryReference: "ref",
      lines: [{ receivedQty: "5", acceptedQty: "3", rejectedQty: "2", isDirect: false, rejectionReason: "damaged" }],
    })
    expect(res.ok && res.data.lines).toHaveLength(1)
  })
  it("marks direct lines", () => {
    const res = buildReceiptPayload(header, open, { [uuid(2)]: { received: "4", rejected: "", reason: "", direct: true } }, "2026-11-28")
    expect(res.ok && res.data.lines[0]).toMatchObject({ isDirect: true, acceptedQty: "4", rejectedQty: "0" })
  })
  it("rejects rejected above received and a missing reason", () => {
    expect(buildReceiptPayload(header, open, { [uuid(1)]: { received: "2", rejected: "3", reason: "x", direct: false } })).toMatchObject({ ok: false, reason: "quantity" })
    expect(buildReceiptPayload(header, open, { [uuid(1)]: { received: "5", rejected: "1", reason: " ", direct: false } })).toMatchObject({ ok: false, reason: "rejectionReason" })
  })
  it("fails when nothing was entered", () => {
    expect(buildReceiptPayload(header, open, {})).toMatchObject({ ok: false, reason: "invalid" })
  })
})
