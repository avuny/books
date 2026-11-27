import { z } from "@avuny/zod"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import {
  SALES_INVOICE_MAX_LINES,
  SALES_INVOICE_NOTES_MAX_LENGTH,
  SALES_INVOICE_PAYMENT_STATUSES,
  SALES_INVOICE_REASON_MAX_LENGTH,
  SALES_INVOICE_STATUSES,
  SALES_INVOICE_LINE_DESCRIPTION_MAX_LENGTH,
} from "./constants.js"

import { CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH } from "../customer-payment/constants.js"
import { CustomerPaymentDtoSchema, CustomerPaymentMethodSchema } from "../customer-payment/schemas.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid quantity")
const text = (max: number) => z.string().trim().max(max)

export const SalesInvoiceStatusSchema = z.enum(SALES_INVOICE_STATUSES)
export const SalesInvoicePaymentStatusSchema = z.enum(SALES_INVOICE_PAYMENT_STATUSES)

/**
 * One invoice line bills part or all of one posted delivery line, in that line's unit. Prices, discount and tax
 * come from the sales order line the goods were ordered on, so a customer is charged what was agreed.
 */
export const SalesInvoiceLineInputSchema = z.object({
  salesDeliveryLineId: id,
  quantity,
  description: text(SALES_INVOICE_LINE_DESCRIPTION_MAX_LENGTH).nullish(),
})
export type SalesInvoiceLineInput = z.infer<typeof SalesInvoiceLineInputSchema>

export const SalesInvoiceLineDtoSchema = z.object({
  id,
  lineNo: z.number().int(),
  salesOrderLineId: id,
  salesDeliveryLineId: id,
  salesDeliveryId: id,
  salesDeliveryNumber: z.string().nullable().optional(),
  itemId: id,
  itemName: z.string().nullable().optional(),
  unitId: id,
  unitSymbol: z.string().nullable().optional(),
  description: z.string().nullable(),
  quantity: z.string(),
  baseQuantity: z.string(),
  /** Agreed price per unit on the order line, minor units. */
  unitPrice: z.string(),
  discountAmount: z.string(),
  netAmount: z.string(),
  taxRateBps: z.number().int(),
  taxAmount: z.string(),
  lineTotal: z.string(),
})
export type SalesInvoiceLineDto = z.infer<typeof SalesInvoiceLineDtoSchema>

const lines = z
  .array(SalesInvoiceLineInputSchema)
  .min(1, "At least one invoice line is required")
  .max(SALES_INVOICE_MAX_LINES, `Maximum ${SALES_INVOICE_MAX_LINES} lines allowed`)

const headerFields = {
  invoiceDate: date,
  /** Optional: calculated from the payment term when empty. */
  dueDate: date.nullish(),
  paymentTermId: id.nullish(),
  notes: text(SALES_INVOICE_NOTES_MAX_LENGTH).nullish(),
}

/** The sales order comes from the path or the body; the customer is the order's customer. */
export const CreateSalesInvoiceSchema = z.object({ salesOrderId: id, ...headerFields, lines })
export type CreateSalesInvoiceInput = z.infer<typeof CreateSalesInvoiceSchema>

/** Prefills the invoice with the uninvoiced quantity of one posted delivery. */
export const CreateSalesInvoiceFromDeliverySchema = z.object({ ...headerFields })
export type CreateSalesInvoiceFromDeliveryInput = z.infer<typeof CreateSalesInvoiceFromDeliverySchema>

export const UpdateSalesInvoiceSchema = z
  .object({
    invoiceDate: date.optional(),
    dueDate: headerFields.dueDate,
    paymentTermId: headerFields.paymentTermId,
    notes: headerFields.notes,
    lines: lines.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdateSalesInvoiceInput = z.infer<typeof UpdateSalesInvoiceSchema>

/**
 * Sales receipt (POS style): invoices what is left on one posted delivery, posts the invoice and
 * records a posted, fully allocated customer payment in one step.
 */
export const CreateSalesReceiptSchema = z.object({
  invoiceDate: date,
  notes: text(SALES_INVOICE_NOTES_MAX_LENGTH).nullish(),
  method: CustomerPaymentMethodSchema,
  referenceNumber: text(CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH).nullish(),
})
export type CreateSalesReceiptInput = z.infer<typeof CreateSalesReceiptSchema>

export const ReverseSalesInvoiceSchema = z.object({
  reason: text(SALES_INVOICE_REASON_MAX_LENGTH).min(1, "A reason is required"),
})
export type ReverseSalesInvoiceInput = z.infer<typeof ReverseSalesInvoiceSchema>

export const SalesInvoiceDtoSchema = z.object({
  id,
  number: z.string(),
  salesOrderId: id,
  salesOrderNumber: z.string().nullable().optional(),
  partyId: id,
  /** Customer name as it was when the invoice was created (immutable snapshot). */
  customerName: z.string().nullable(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  paymentTermId: id.nullable(),
  paymentTermName: z.string().nullable(),
  notes: z.string().nullable(),
  status: SalesInvoiceStatusSchema,
  currency: z.string(),
  /** Net sales before tax (after discount). */
  subtotal: z.string(),
  discountAmount: z.string(),
  taxAmount: z.string(),
  total: z.string(),
  /** Applied by posted customer payments. */
  paidAmount: z.string(),
  /** Posted credit notes against this invoice. They reduce the outstanding amount like a payment does. */
  creditedAmount: z.string(),
  outstandingAmount: z.string(),
  paymentStatus: SalesInvoicePaymentStatusSchema.nullable(),
  journalEntryId: id.nullable(),
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  reversedAt: timestamp.nullable(),
  reversedBy: id.nullable(),
  reverseReason: z.string().nullable(),
  createdBy: id.nullable(),
  lines: z.array(SalesInvoiceLineDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type SalesInvoiceDto = z.infer<typeof SalesInvoiceDtoSchema>

export const SalesInvoiceListResponseSchema = z.object({
  items: z.array(SalesInvoiceDtoSchema),
})
export type SalesInvoiceListResponse = z.infer<typeof SalesInvoiceListResponseSchema>

export const SalesReceiptDtoSchema = z.object({
  invoice: SalesInvoiceDtoSchema,
  payment: CustomerPaymentDtoSchema,
})
export type SalesReceiptDto = z.infer<typeof SalesReceiptDtoSchema>
