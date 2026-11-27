/** Sales invoice constants: the customer-facing financial document (accounts receivable) for delivered goods. */

export const SALES_INVOICE_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type SalesInvoiceStatus = (typeof SALES_INVOICE_STATUSES)[number]

export const SALES_INVOICE_NUMBER_PREFIX = "INV-"
export const SALES_INVOICE_NUMBER_PAD = 6
export const SALES_INVOICE_NUMBER_REGEX = /^INV-[0-9]{6,}$/ // ck_sales_invoice_number_fmt

export const SALES_INVOICE_NOTES_MAX_LENGTH = 1000 // ck_sales_invoice_text_len
export const SALES_INVOICE_REASON_MAX_LENGTH = 500
export const SALES_INVOICE_LINE_DESCRIPTION_MAX_LENGTH = 500 // ck_sales_invoice_line_text_len
export const SALES_INVOICE_MAX_LINES = 500
export const SALES_INVOICE_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_sales_invoice_*_amount_max

/** Source type written on the journal entry of a posted invoice. */
export const SALES_INVOICE_SOURCE_TYPE = "sales_invoice"

export const SALES_INVOICE_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const
export type SalesInvoicePaymentStatus = (typeof SALES_INVOICE_PAYMENT_STATUSES)[number]

export const SALES_INVOICE_AUDIT_EVENTS = {
  CREATED: "sales_invoice.created",
  UPDATED: "sales_invoice.updated",
  DELETED: "sales_invoice.deleted",
  POSTED: "sales_invoice.posted",
  REVERSED: "sales_invoice.reversed",
} as const
