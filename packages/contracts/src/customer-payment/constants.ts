/** Customer payment constants: money received from a customer and applied to posted customer invoices. */
import { ACCOUNTING_PAYMENT_METHODS } from "../accounting/schemas.js"

export const CUSTOMER_PAYMENT_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type CustomerPaymentStatus = (typeof CUSTOMER_PAYMENT_STATUSES)[number]

/** Cash or bank: the accounting event picks the ledger account from the method (SPEC deviation D3). */
export const CUSTOMER_PAYMENT_METHODS = ACCOUNTING_PAYMENT_METHODS
export type CustomerPaymentMethod = (typeof CUSTOMER_PAYMENT_METHODS)[number]

export const CUSTOMER_PAYMENT_NUMBER_PREFIX = "CP-"
export const CUSTOMER_PAYMENT_NUMBER_PAD = 6
export const CUSTOMER_PAYMENT_NUMBER_REGEX = /^CP-[0-9]{6,}$/ // ck_customer_payment_number_fmt

export const CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH = 100 // ck_customer_payment_text_len
export const CUSTOMER_PAYMENT_NOTES_MAX_LENGTH = 1000 // ck_customer_payment_text_len
export const CUSTOMER_PAYMENT_REASON_MAX_LENGTH = 500
export const CUSTOMER_PAYMENT_MAX_ALLOCATIONS = 200
export const CUSTOMER_PAYMENT_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_customer_payment_amount_max

export const CUSTOMER_PAYMENT_AUDIT_EVENTS = {
  CREATED: "customer_payment.created",
  UPDATED: "customer_payment.updated",
  DELETED: "customer_payment.deleted",
  POSTED: "customer_payment.posted",
  REVERSED: "customer_payment.reversed",
} as const
