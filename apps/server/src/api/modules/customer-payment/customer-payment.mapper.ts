import type { CustomerPaymentAllocationDto, CustomerPaymentDto } from "@avuny/contracts"
import type { CustomerPaymentAllocationDetailRow, CustomerPaymentDetailRow } from "./customer-payment.types.js"

const toAllocationDto = (a: CustomerPaymentAllocationDetailRow): CustomerPaymentAllocationDto => ({
  id: a.id,
  salesInvoiceId: a.salesInvoiceId,
  salesInvoiceNumber: a.salesInvoiceNumber ?? null,
  amount: String(a.allocatedAmount),
})

export const toCustomerPaymentDto = (
  r: CustomerPaymentDetailRow,
  allocations: readonly CustomerPaymentAllocationDetailRow[]
): CustomerPaymentDto => ({
  id: r.id,
  number: r.number,
  partyId: r.partyId,
  partyName: r.partyName ?? null,
  paymentDate: r.paymentDate,
  method: r.method,
  referenceNumber: r.referenceNumber ?? null,
  notes: r.notes ?? null,
  status: r.status,
  currency: r.currency,
  amount: String(r.amount),
  journalEntryId: r.journalEntryId ?? null,
  postedAt: r.postedAt?.toISOString() ?? null,
  postedBy: r.postedBy ?? null,
  reversedAt: r.reversedAt?.toISOString() ?? null,
  reversedBy: r.reversedBy ?? null,
  reverseReason: r.reverseReason ?? null,
  createdBy: r.createdBy ?? null,
  allocations: allocations.map(toAllocationDto),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
})
