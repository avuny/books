import { z } from "@avuny/zod"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import {
  VENDOR_BILL_LINE_DESCRIPTION_MAX_LENGTH,
  VENDOR_BILL_MAX_LINES,
  VENDOR_BILL_MAX_MINOR_AMOUNT,
  VENDOR_BILL_MAX_RATE_BPS,
  VENDOR_BILL_NOTES_MAX_LENGTH,
  VENDOR_BILL_REASON_MAX_LENGTH,
  VENDOR_BILL_STATUSES,
  VENDOR_BILL_SUPPLIER_INVOICE_MAX_LENGTH,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid quantity")
const minor = z
  .string()
  .regex(/^\d+$/, "Use whole minor units")
  .refine((v) => BigInt(v) <= BigInt(VENDOR_BILL_MAX_MINOR_AMOUNT), "Amount is too large")
const text = (max: number) => z.string().trim().max(max)

export const VendorBillStatusSchema = z.enum(VENDOR_BILL_STATUSES)

/**
 * One bill line invoices part or all of one posted receipt line, in that line's unit.
 * `netAmountMinor` is the line amount as printed on the supplier invoice (before tax).
 */
export const VendorBillLineInputSchema = z.object({
  purchaseReceiptLineId: id,
  billedQty: quantity,
  netAmountMinor: minor,
  taxRateBps: z.number().int().min(0).max(VENDOR_BILL_MAX_RATE_BPS).default(0),
  description: text(VENDOR_BILL_LINE_DESCRIPTION_MAX_LENGTH).nullish(),
})
export type VendorBillLineInput = z.infer<typeof VendorBillLineInputSchema>

export const VendorBillLineDtoSchema = z.object({
  id,
  lineNo: z.number().int(),
  purchaseReceiptLineId: id,
  purchaseReceiptId: id,
  purchaseReceiptNumber: z.string().nullable().optional(),
  itemId: id,
  itemName: z.string().nullable().optional(),
  unitId: id,
  unitSymbol: z.string().nullable().optional(),
  description: z.string().nullable(),
  billedQty: z.string(),
  billedBaseQty: z.string(),
  /** Net amount on the supplier invoice, minor units. */
  netAmount: z.string(),
  taxRateBps: z.number().int(),
  taxAmount: z.string(),
  lineTotal: z.string(),
  /** Value of the received goods this line clears from GRNI, minor units. */
  matchedValue: z.string(),
})
export type VendorBillLineDto = z.infer<typeof VendorBillLineDtoSchema>

const lines = z
  .array(VendorBillLineInputSchema)
  .min(1, "At least one bill line is required")
  .max(VENDOR_BILL_MAX_LINES, `Maximum ${VENDOR_BILL_MAX_LINES} lines allowed`)

const headerFields = {
  supplierInvoiceNumber: text(VENDOR_BILL_SUPPLIER_INVOICE_MAX_LENGTH).nullish(),
  invoiceDate: date,
  /** Optional: calculated from the payment term when empty. */
  dueDate: date.nullish(),
  paymentTermId: id.nullish(),
  notes: text(VENDOR_BILL_NOTES_MAX_LENGTH).nullish(),
}

export const CreateVendorBillSchema = z.object({ partyId: id, ...headerFields, lines })
export type CreateVendorBillInput = z.infer<typeof CreateVendorBillSchema>

/** Prefills the bill with the unbilled accepted quantity of one posted receipt, at the receipt value. */
export const CreateVendorBillFromReceiptSchema = z.object({
  purchaseReceiptId: id,
  ...headerFields,
})
export type CreateVendorBillFromReceiptInput = z.infer<typeof CreateVendorBillFromReceiptSchema>

export const UpdateVendorBillSchema = z
  .object({
    supplierInvoiceNumber: headerFields.supplierInvoiceNumber,
    invoiceDate: date.optional(),
    dueDate: headerFields.dueDate,
    paymentTermId: headerFields.paymentTermId,
    notes: headerFields.notes,
    lines: lines.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdateVendorBillInput = z.infer<typeof UpdateVendorBillSchema>

export const ReverseVendorBillSchema = z.object({
  reason: text(VENDOR_BILL_REASON_MAX_LENGTH).min(1, "A reason is required"),
})
export type ReverseVendorBillInput = z.infer<typeof ReverseVendorBillSchema>

export const VendorBillDtoSchema = z.object({
  id,
  number: z.string(),
  partyId: id,
  partyName: z.string().nullable().optional(),
  supplierInvoiceNumber: z.string().nullable(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  paymentTermId: id.nullable(),
  paymentTermName: z.string().nullable(),
  notes: z.string().nullable(),
  status: VendorBillStatusSchema,
  currency: z.string(),
  subtotal: z.string(),
  taxAmount: z.string(),
  total: z.string(),
  /** Goods value cleared from GRNI. Variance = subtotal - receivedValue. */
  receivedValue: z.string(),
  priceVariance: z.string(),
  /** Applied by posted vendor payments. */
  paidAmount: z.string(),
  outstandingAmount: z.string(),
  paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).nullable(),
  journalEntryId: id.nullable(),
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  reversedAt: timestamp.nullable(),
  reversedBy: id.nullable(),
  reverseReason: z.string().nullable(),
  createdBy: id.nullable(),
  lines: z.array(VendorBillLineDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type VendorBillDto = z.infer<typeof VendorBillDtoSchema>

export const VendorBillListResponseSchema = z.object({
  items: z.array(VendorBillDtoSchema),
})
export type VendorBillListResponse = z.infer<typeof VendorBillListResponseSchema>
