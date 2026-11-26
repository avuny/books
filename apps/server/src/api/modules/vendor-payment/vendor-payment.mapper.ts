import type { VendorPaymentAllocationDto, VendorPaymentDto } from "@avuny/contracts"
import type { VendorPaymentAllocationDetailRow, VendorPaymentDetailRow } from "./vendor-payment.types.js"

const toAllocationDto = (a: VendorPaymentAllocationDetailRow): VendorPaymentAllocationDto => ({
  id: a.id,
  vendorBillId: a.vendorBillId,
  vendorBillNumber: a.vendorBillNumber ?? null,
  supplierInvoiceNumber: a.supplierInvoiceNumber ?? null,
  amount: String(a.allocatedAmount),
})

export const toVendorPaymentDto = (
  r: VendorPaymentDetailRow,
  allocations: readonly VendorPaymentAllocationDetailRow[]
): VendorPaymentDto => ({
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
