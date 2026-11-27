import { z } from "@avuny/zod"
import {
  SALES_CREDIT_NOTE_MAX_MINOR_AMOUNT,
  SALES_CREDIT_NOTE_NOTES_MAX_LENGTH,
  SALES_CREDIT_NOTE_REASON_MAX_LENGTH,
  SALES_CREDIT_NOTE_STATUSES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const minor = z
  .string()
  .regex(/^\d+$/, "Use whole minor units")
  .refine((v) => BigInt(v) <= BigInt(SALES_CREDIT_NOTE_MAX_MINOR_AMOUNT), "Amount is too large")
const text = (max: number) => z.string().trim().max(max)

export const SalesCreditNoteStatusSchema = z.enum(SALES_CREDIT_NOTE_STATUSES)

const headerFields = {
  creditDate: date,
  /** Gross credit (net plus tax). Tax is split in the invoice's own proportion. */
  amountMinor: minor,
  reason: text(SALES_CREDIT_NOTE_REASON_MAX_LENGTH).min(1, "A reason is required"),
  notes: text(SALES_CREDIT_NOTE_NOTES_MAX_LENGTH).nullish(),
}

export const CreateSalesCreditNoteSchema = z.object({ salesInvoiceId: id, ...headerFields })
export type CreateSalesCreditNoteInput = z.infer<typeof CreateSalesCreditNoteSchema>

export const UpdateSalesCreditNoteSchema = z
  .object({
    creditDate: headerFields.creditDate.optional(),
    amountMinor: headerFields.amountMinor.optional(),
    reason: headerFields.reason.optional(),
    notes: headerFields.notes,
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdateSalesCreditNoteInput = z.infer<typeof UpdateSalesCreditNoteSchema>

export const ReverseSalesCreditNoteSchema = z.object({
  reason: text(SALES_CREDIT_NOTE_REASON_MAX_LENGTH).min(1, "A reason is required"),
})
export type ReverseSalesCreditNoteInput = z.infer<typeof ReverseSalesCreditNoteSchema>

export const SalesCreditNoteDtoSchema = z.object({
  id,
  number: z.string(),
  partyId: id,
  customerName: z.string().nullable(),
  salesInvoiceId: id,
  salesInvoiceNumber: z.string().nullable(),
  creditDate: z.string(),
  reason: z.string(),
  notes: z.string().nullable(),
  status: SalesCreditNoteStatusSchema,
  currency: z.string(),
  netAmount: z.string(),
  taxAmount: z.string(),
  total: z.string(),
  journalEntryId: id.nullable(),
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  reversedAt: timestamp.nullable(),
  reversedBy: id.nullable(),
  reverseReason: z.string().nullable(),
  createdBy: id.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type SalesCreditNoteDto = z.infer<typeof SalesCreditNoteDtoSchema>

export const SalesCreditNoteListResponseSchema = z.object({ items: z.array(SalesCreditNoteDtoSchema) })
export type SalesCreditNoteListResponse = z.infer<typeof SalesCreditNoteListResponseSchema>
