import type { SalesCreditNoteDto } from "@avuny/contracts"
import type { SalesCreditNoteDetailRow } from "./sales-credit-note.types.js"

export const toSalesCreditNoteDto = (r: SalesCreditNoteDetailRow): SalesCreditNoteDto => ({
  id: r.id,
  number: r.number,
  partyId: r.partyId,
  customerName: r.customerNameSnapshot ?? null,
  salesInvoiceId: r.salesInvoiceId,
  salesInvoiceNumber: r.salesInvoiceNumber ?? null,
  creditDate: r.creditDate,
  reason: r.reason,
  notes: r.notes ?? null,
  status: r.status,
  currency: r.currency,
  netAmount: String(r.netAmount),
  taxAmount: String(r.taxAmount),
  total: String(r.totalAmount),
  journalEntryId: r.journalEntryId ?? null,
  postedAt: r.postedAt?.toISOString() ?? null,
  postedBy: r.postedBy ?? null,
  reversedAt: r.reversedAt?.toISOString() ?? null,
  reversedBy: r.reversedBy ?? null,
  reverseReason: r.reverseReason ?? null,
  createdBy: r.createdBy ?? null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
})
