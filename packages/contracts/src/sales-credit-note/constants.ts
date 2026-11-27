/** Sales credit note constants: a posted-invoice correction that reduces what the customer owes. */
export const SALES_CREDIT_NOTE_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type SalesCreditNoteStatus = (typeof SALES_CREDIT_NOTE_STATUSES)[number]

export const SALES_CREDIT_NOTE_NUMBER_PREFIX = "CN-"
export const SALES_CREDIT_NOTE_NUMBER_PAD = 6
export const SALES_CREDIT_NOTE_NUMBER_REGEX = /^CN-[0-9]{6,}$/ // ck_sales_credit_note_number_fmt

export const SALES_CREDIT_NOTE_REASON_MAX_LENGTH = 500 // ck_sales_credit_note_text_len
export const SALES_CREDIT_NOTE_NOTES_MAX_LENGTH = 1000 // ck_sales_credit_note_text_len
export const SALES_CREDIT_NOTE_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_sales_credit_note_amount_max

export const SALES_CREDIT_NOTE_AUDIT_EVENTS = {
  CREATED: "sales_credit_note.created",
  UPDATED: "sales_credit_note.updated",
  DELETED: "sales_credit_note.deleted",
  POSTED: "sales_credit_note.posted",
  REVERSED: "sales_credit_note.reversed",
} as const
