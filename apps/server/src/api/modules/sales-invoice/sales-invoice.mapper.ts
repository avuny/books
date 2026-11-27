import { computeOutstanding, derivePaymentStatus, type SalesInvoiceDto, type SalesInvoiceLineDto } from "@avuny/contracts"
import type { SalesInvoiceDetailRow, SalesInvoiceLineDetailRow } from "./sales-invoice.types.js"

const toLineDto = (l: SalesInvoiceLineDetailRow): SalesInvoiceLineDto => ({
  id: l.id,
  lineNo: l.lineNo,
  salesOrderLineId: l.salesOrderLineId,
  salesDeliveryLineId: l.salesDeliveryLineId,
  salesDeliveryId: l.salesDeliveryId,
  salesDeliveryNumber: l.salesDeliveryNumber ?? null,
  itemId: l.itemId,
  itemName: l.itemName ?? null,
  unitId: l.unitId,
  unitSymbol: l.unitSymbol ?? null,
  description: l.description ?? null,
  quantity: l.quantity,
  baseQuantity: l.baseQuantity,
  unitPrice: String(l.unitPrice),
  discountAmount: String(l.discountAmount),
  netAmount: String(l.netAmount),
  taxRateBps: l.taxRateBps,
  taxAmount: String(l.taxAmount),
  lineTotal: String(l.lineTotalAmount),
})

export const toSalesInvoiceDto = (
  r: SalesInvoiceDetailRow,
  lines: readonly SalesInvoiceLineDetailRow[]
): SalesInvoiceDto => {
  const paid = String(r.paidAmount ?? 0)
  const credited = String(r.creditedAmount ?? 0)
  const settled = String(BigInt(paid) + BigInt(credited))
  const total = String(r.totalAmount)
  return {
    id: r.id,
    number: r.number,
    salesOrderId: r.salesOrderId,
    salesOrderNumber: r.salesOrderNumber ?? null,
    partyId: r.partyId,
    customerName: r.customerNameSnapshot ?? null,
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    paymentTermId: r.paymentTermId ?? null,
    paymentTermName: r.paymentTermNameSnapshot ?? null,
    notes: r.notes ?? null,
    status: r.status,
    currency: r.currency,
    subtotal: String(r.subtotalAmount),
    discountAmount: String(r.discountAmount),
    taxAmount: String(r.taxAmount),
    total,
    paidAmount: paid,
    creditedAmount: credited,
    outstandingAmount: r.status === "POSTED" ? String(computeOutstanding(total, settled)) : "0",
    paymentStatus: r.status === "POSTED" ? derivePaymentStatus(total, settled) : null,
    journalEntryId: r.journalEntryId ?? null,
    postedAt: r.postedAt?.toISOString() ?? null,
    postedBy: r.postedBy ?? null,
    reversedAt: r.reversedAt?.toISOString() ?? null,
    reversedBy: r.reversedBy ?? null,
    reverseReason: r.reverseReason ?? null,
    createdBy: r.createdBy ?? null,
    lines: [...lines].sort((a, b) => a.lineNo - b.lineNo).map(toLineDto),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}
