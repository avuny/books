import { z } from "@avuny/zod"
import {
  VENDOR_PAYMENT_MAX_ALLOCATIONS,
  VENDOR_PAYMENT_MAX_MINOR_AMOUNT,
  VENDOR_PAYMENT_METHODS,
  VENDOR_PAYMENT_NOTES_MAX_LENGTH,
  VENDOR_PAYMENT_REASON_MAX_LENGTH,
  VENDOR_PAYMENT_REFERENCE_MAX_LENGTH,
  VENDOR_PAYMENT_STATUSES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const minor = z
  .string()
  .regex(/^\d+$/, "Use whole minor units")
  .refine((v) => BigInt(v) <= BigInt(VENDOR_PAYMENT_MAX_MINOR_AMOUNT), "Amount is too large")
const text = (max: number) => z.string().trim().max(max)

export const VendorPaymentStatusSchema = z.enum(VENDOR_PAYMENT_STATUSES)
export const VendorPaymentMethodSchema = z.enum(VENDOR_PAYMENT_METHODS)

/** The payment amount is the sum of its allocations: every unit paid is applied to a posted bill. */
export const VendorPaymentAllocationInputSchema = z.object({
  vendorBillId: id,
  amountMinor: minor,
})
export type VendorPaymentAllocationInput = z.infer<typeof VendorPaymentAllocationInputSchema>

export const VendorPaymentAllocationDtoSchema = z.object({
  id,
  vendorBillId: id,
  vendorBillNumber: z.string().nullable().optional(),
  supplierInvoiceNumber: z.string().nullable().optional(),
  amount: z.string(),
})
export type VendorPaymentAllocationDto = z.infer<typeof VendorPaymentAllocationDtoSchema>

const allocations = z
  .array(VendorPaymentAllocationInputSchema)
  .min(1, "Apply the payment to at least one bill")
  .max(VENDOR_PAYMENT_MAX_ALLOCATIONS, `Maximum ${VENDOR_PAYMENT_MAX_ALLOCATIONS} bills per payment`)

const headerFields = {
  paymentDate: date,
  method: VendorPaymentMethodSchema,
  referenceNumber: text(VENDOR_PAYMENT_REFERENCE_MAX_LENGTH).nullish(),
  notes: text(VENDOR_PAYMENT_NOTES_MAX_LENGTH).nullish(),
}

export const CreateVendorPaymentSchema = z.object({ partyId: id, ...headerFields, allocations })
export type CreateVendorPaymentInput = z.infer<typeof CreateVendorPaymentSchema>

export const UpdateVendorPaymentSchema = z
  .object({
    paymentDate: date.optional(),
    method: VendorPaymentMethodSchema.optional(),
    referenceNumber: headerFields.referenceNumber,
    notes: headerFields.notes,
    allocations: allocations.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdateVendorPaymentInput = z.infer<typeof UpdateVendorPaymentSchema>

export const ReverseVendorPaymentSchema = z.object({
  reason: text(VENDOR_PAYMENT_REASON_MAX_LENGTH).min(1, "A reason is required"),
})
export type ReverseVendorPaymentInput = z.infer<typeof ReverseVendorPaymentSchema>

export const VendorPaymentDtoSchema = z.object({
  id,
  number: z.string(),
  partyId: id,
  partyName: z.string().nullable().optional(),
  paymentDate: z.string(),
  method: VendorPaymentMethodSchema,
  referenceNumber: z.string().nullable(),
  notes: z.string().nullable(),
  status: VendorPaymentStatusSchema,
  currency: z.string(),
  amount: z.string(),
  journalEntryId: id.nullable(),
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  reversedAt: timestamp.nullable(),
  reversedBy: id.nullable(),
  reverseReason: z.string().nullable(),
  createdBy: id.nullable(),
  allocations: z.array(VendorPaymentAllocationDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type VendorPaymentDto = z.infer<typeof VendorPaymentDtoSchema>

export const VendorPaymentListResponseSchema = z.object({
  items: z.array(VendorPaymentDtoSchema),
})
export type VendorPaymentListResponse = z.infer<typeof VendorPaymentListResponseSchema>
