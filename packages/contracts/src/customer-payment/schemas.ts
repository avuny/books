import { z } from "@avuny/zod"
import {
  CUSTOMER_PAYMENT_MAX_ALLOCATIONS,
  CUSTOMER_PAYMENT_MAX_MINOR_AMOUNT,
  CUSTOMER_PAYMENT_METHODS,
  CUSTOMER_PAYMENT_NOTES_MAX_LENGTH,
  CUSTOMER_PAYMENT_REASON_MAX_LENGTH,
  CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH,
  CUSTOMER_PAYMENT_STATUSES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const minor = z
  .string()
  .regex(/^\d+$/, "Use whole minor units")
  .refine((v) => BigInt(v) <= BigInt(CUSTOMER_PAYMENT_MAX_MINOR_AMOUNT), "Amount is too large")
const text = (max: number) => z.string().trim().max(max)

export const CustomerPaymentStatusSchema = z.enum(CUSTOMER_PAYMENT_STATUSES)
export const CustomerPaymentMethodSchema = z.enum(CUSTOMER_PAYMENT_METHODS)

/** The payment amount is the sum of its allocations: every unit paid is applied to a posted invoice. */
export const CustomerPaymentAllocationInputSchema = z.object({
  salesInvoiceId: id,
  amountMinor: minor,
})
export type CustomerPaymentAllocationInput = z.infer<typeof CustomerPaymentAllocationInputSchema>

export const CustomerPaymentAllocationDtoSchema = z.object({
  id,
  salesInvoiceId: id,
  salesInvoiceNumber: z.string().nullable().optional(),
  amount: z.string(),
})
export type CustomerPaymentAllocationDto = z.infer<typeof CustomerPaymentAllocationDtoSchema>

const allocations = z
  .array(CustomerPaymentAllocationInputSchema)
  .min(1, "Apply the payment to at least one invoice")
  .max(CUSTOMER_PAYMENT_MAX_ALLOCATIONS, `Maximum ${CUSTOMER_PAYMENT_MAX_ALLOCATIONS} invoices per payment`)

const headerFields = {
  paymentDate: date,
  method: CustomerPaymentMethodSchema,
  referenceNumber: text(CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH).nullish(),
  notes: text(CUSTOMER_PAYMENT_NOTES_MAX_LENGTH).nullish(),
}

export const CreateCustomerPaymentSchema = z.object({ partyId: id, ...headerFields, allocations })
export type CreateCustomerPaymentInput = z.infer<typeof CreateCustomerPaymentSchema>

export const UpdateCustomerPaymentSchema = z
  .object({
    paymentDate: date.optional(),
    method: CustomerPaymentMethodSchema.optional(),
    referenceNumber: headerFields.referenceNumber,
    notes: headerFields.notes,
    allocations: allocations.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdateCustomerPaymentInput = z.infer<typeof UpdateCustomerPaymentSchema>

export const ReverseCustomerPaymentSchema = z.object({
  reason: text(CUSTOMER_PAYMENT_REASON_MAX_LENGTH).min(1, "A reason is required"),
})
export type ReverseCustomerPaymentInput = z.infer<typeof ReverseCustomerPaymentSchema>

export const CustomerPaymentDtoSchema = z.object({
  id,
  number: z.string(),
  partyId: id,
  partyName: z.string().nullable().optional(),
  paymentDate: z.string(),
  method: CustomerPaymentMethodSchema,
  referenceNumber: z.string().nullable(),
  notes: z.string().nullable(),
  status: CustomerPaymentStatusSchema,
  currency: z.string(),
  amount: z.string(),
  journalEntryId: id.nullable(),
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  reversedAt: timestamp.nullable(),
  reversedBy: id.nullable(),
  reverseReason: z.string().nullable(),
  createdBy: id.nullable(),
  allocations: z.array(CustomerPaymentAllocationDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type CustomerPaymentDto = z.infer<typeof CustomerPaymentDtoSchema>

export const CustomerPaymentListResponseSchema = z.object({
  items: z.array(CustomerPaymentDtoSchema),
})
export type CustomerPaymentListResponse = z.infer<typeof CustomerPaymentListResponseSchema>
