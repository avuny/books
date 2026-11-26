import { CreatePurchaseReceiptSchema, cmpQty, subQty, type CreatePurchaseReceiptInput } from "@avuny/contracts"

import type { PurchaseOrderDto, PurchaseOrderLineDto } from "../types"

/** Lines that can still receive goods: something in transit, or something not shipped yet (direct receipt). */
export function openReceiptLines(order: PurchaseOrderDto): PurchaseOrderLineDto[] {
  return order.lines.filter((l) => Number(l.inTransitBaseQty) > 0 || Number(l.unshippedBaseQty) > 0)
}

export type ReceiptFormHeader = { date: string; reference: string; notes: string }
export type ReceiptLineInput = { received: string; rejected: string; reason: string; direct: boolean }

export type BuildReceiptResult =
  | { ok: true; data: CreatePurchaseReceiptInput }
  | { ok: false; reason: "quantity" | "rejectionReason" | "invalid"; message: string }

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Build the create payload from typed quantities (in each line's own unit). Accepted = received - rejected.
 * Lines with a blank or zero received quantity are skipped. Goods go to the order line's location.
 * The date defaults to today (local calendar day) when left blank.
 */
export function buildReceiptPayload(
  header: ReceiptFormHeader,
  open: PurchaseOrderLineDto[],
  rows: Record<string, ReceiptLineInput | undefined>,
  today: string = new Date().toLocaleDateString("en-CA")
): BuildReceiptResult {
  const lines = []
  for (const l of open) {
    const row = rows[l.id]
    const received = (row?.received ?? "").trim()
    if (received === "" || Number(received) === 0) continue
    const rejected = (row?.rejected ?? "").trim() || "0"
    if (!DECIMAL.test(received) || !DECIMAL.test(rejected) || cmpQty(rejected, received) > 0) {
      return { ok: false, reason: "quantity", message: "quantity" }
    }
    if (Number(rejected) > 0 && !(row?.reason ?? "").trim()) {
      return { ok: false, reason: "rejectionReason", message: "rejectionReason" }
    }
    lines.push({
      purchaseOrderLineId: l.id,
      unitId: l.unitId,
      locationId: l.locationId,
      receivedQty: received,
      acceptedQty: subQty(received, rejected),
      rejectedQty: rejected,
      isDirect: row?.direct ?? false,
      rejectionReason: Number(rejected) > 0 ? (row?.reason ?? "").trim() : null,
    })
  }
  const parsed = CreatePurchaseReceiptSchema.safeParse({
    receiptDate: header.date || today,
    supplierDeliveryReference: header.reference.trim() || null,
    notes: header.notes.trim() || null,
    lines,
  })
  if (!parsed.success) return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "invalid" }
  return { ok: true, data: parsed.data }
}
