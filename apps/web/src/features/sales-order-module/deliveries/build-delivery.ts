import { CreateSalesDeliverySchema, cmpQty, mulQty, type CreateSalesDeliveryInput } from "@avuny/contracts"

import type { SalesOrderDto, SalesOrderLineDto } from "../types"

/** Lines that still have something to deliver. */
export function openDeliveryLines(order: SalesOrderDto): SalesOrderLineDto[] {
  return order.lines.filter((l) => Number(l.openToDeliverBaseQty) > 0)
}

/** Open quantity in the line's own unit (base quantity divided by the unit factor), trimmed of trailing zeros. */
export function openQtyInUnit(line: SalesOrderLineDto): string {
  const factor = Number(line.baseUnitFactor) || 1
  const v = Number(line.openToDeliverBaseQty) / factor
  return String(Math.round(v * 1e6) / 1e6)
}

export type DeliveryFormHeader = { date: string; carrier: string; trackingNumber: string; notes: string }

export type BuildDeliveryResult =
  | { ok: true; data: CreateSalesDeliveryInput }
  | { ok: false; reason: "quantity" | "empty" | "invalid"; message: string }

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Build the create payload from typed quantities (in each line's own unit). Blank or zero lines are skipped.
 * Goods leave from the order line's location and unit. The date defaults to today when left blank.
 */
export function buildDeliveryPayload(
  header: DeliveryFormHeader,
  open: SalesOrderLineDto[],
  rows: Record<string, string | undefined>,
  today: string = new Date().toLocaleDateString("en-CA")
): BuildDeliveryResult {
  const lines = []
  for (const l of open) {
    const qty = (rows[l.id] ?? "").trim()
    if (qty === "" || Number(qty) === 0) continue
    if (!DECIMAL.test(qty) || cmpQty(mulQty(qty, l.baseUnitFactor), l.openToDeliverBaseQty) > 0) {
      return { ok: false, reason: "quantity", message: "quantity" }
    }
    lines.push({ salesOrderLineId: l.id, unitId: l.unitId, locationId: l.locationId, quantity: qty })
  }
  if (lines.length === 0) return { ok: false, reason: "empty", message: "empty" }
  const parsed = CreateSalesDeliverySchema.safeParse({
    deliveryDate: header.date || today,
    carrier: header.carrier.trim() || null,
    trackingNumber: header.trackingNumber.trim() || null,
    notes: header.notes.trim() || null,
    lines,
  })
  if (!parsed.success) return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "invalid" }
  return { ok: true, data: parsed.data }
}
