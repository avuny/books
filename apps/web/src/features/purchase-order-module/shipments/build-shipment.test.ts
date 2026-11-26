import { describe, expect, it } from "vitest"

import type { PurchaseOrderDto } from "../types"
import { buildShipmentPayload, openShipmentLines } from "./build-shipment"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const line = (n: number, unshipped: string) =>
  ({ id: uuid(n), itemId: uuid(100 + n), unitId: uuid(200 + n), unshippedBaseQty: unshipped, itemName: `Item ${n}` }) as never

const order = { lines: [line(1, "10"), line(2, "0"), line(3, "5")] } as unknown as PurchaseOrderDto
const header = { date: "", carrier: " DHL ", tracking: "", reference: "" }

describe("shipment payload", () => {
  it("lists only lines with unshipped quantity", () => {
    expect(openShipmentLines(order).map((l) => l.id)).toEqual([uuid(1), uuid(3)])
  })

  it("builds a payload from typed quantities and skips blank lines", () => {
    const open = openShipmentLines(order)
    const r = buildShipmentPayload(header, open, { [uuid(1)]: "4", [uuid(3)]: "" }, "2026-11-26")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.shipmentDate).toBe("2026-11-26")
    expect(r.data.carrier).toBe("DHL")
    expect(r.data.lines).toEqual([{ purchaseOrderLineId: uuid(1), unitId: uuid(201), shippedQty: "4" }])
  })

  it("fails when nothing is shipped or the quantity is invalid", () => {
    const open = openShipmentLines(order)
    expect(buildShipmentPayload(header, open, {}, "2026-11-26").ok).toBe(false)
    expect(buildShipmentPayload(header, open, { [uuid(1)]: "abc" }, "2026-11-26").ok).toBe(false)
  })
})
