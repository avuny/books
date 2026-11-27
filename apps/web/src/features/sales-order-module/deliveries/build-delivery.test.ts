import { describe, expect, it } from "vitest"
import type { SalesOrderDto } from "../types"
import { buildDeliveryPayload, openDeliveryLines, openQtyInUnit } from "./build-delivery"

const line = (over: Record<string, unknown> = {}) =>
  ({
    id: "11111111-1111-4111-a111-111111111111",
    unitId: "22222222-2222-4222-a222-222222222222",
    locationId: "33333333-3333-4333-a333-333333333333",
    baseUnitFactor: "12",
    openToDeliverBaseQty: "24",
    ...over,
  }) as any

describe("build-delivery", () => {
  it("lists only lines with open quantity and shows it in the line unit", () => {
    const order = { lines: [line(), line({ id: "x", openToDeliverBaseQty: "0" })] } as unknown as SalesOrderDto
    expect(openDeliveryLines(order)).toHaveLength(1)
    expect(openQtyInUnit(line())).toBe("2")
  })

  it("builds a payload, skipping blank lines, and defaults the date", () => {
    const res = buildDeliveryPayload({ date: "", carrier: " DHL ", trackingNumber: "", notes: "" }, [line()], { [line().id]: "1" }, "2026-11-28")
    expect(res).toMatchObject({ ok: true, data: { deliveryDate: "2026-11-28", carrier: "DHL", lines: [{ quantity: "1" }] } })
  })

  it("rejects quantities above open and empty deliveries", () => {
    const l = line()
    expect(buildDeliveryPayload({ date: "", carrier: "", trackingNumber: "", notes: "" }, [l], { [l.id]: "3" })).toMatchObject({ ok: false, reason: "quantity" })
    expect(buildDeliveryPayload({ date: "", carrier: "", trackingNumber: "", notes: "" }, [l], {})).toMatchObject({ ok: false, reason: "empty" })
  })
})
