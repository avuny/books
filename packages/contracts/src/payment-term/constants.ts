/**
 * Payment term module constants (shared purchasing/AP reference data).
 * Limits that back a database check carry the constraint name.
 */

export const PAYMENT_TERM_METHODS = [
  "DUE_ON_RECEIPT",
  "NET_DAYS",
  "END_OF_MONTH",
  "END_OF_NEXT_MONTH",
  "DAYS_AFTER_END_OF_MONTH",
] as const
export type PaymentTermMethod = (typeof PAYMENT_TERM_METHODS)[number]

/** System-seeded terms count toward the cap (PURCHASE-ORDER SPEC 7.2). */
export const PAYMENT_TERMS_MAX_PER_ORG = 20
export const PAYMENT_TERM_NAME_MIN_LENGTH = 1 // ck_payment_term_name_len
export const PAYMENT_TERM_NAME_MAX_LENGTH = 80 // ck_payment_term_name_len
export const PAYMENT_TERM_CODE_MAX_LENGTH = 40 // ck_payment_term_code_len
export const PAYMENT_TERM_DAYS_MAX = 3650 // ck_payment_term_days_range

/** Methods that need no day count; the stored days must be 0. */
export const PAYMENT_TERM_METHODS_WITHOUT_DAYS: readonly PaymentTermMethod[] = [
  "DUE_ON_RECEIPT",
  "END_OF_MONTH",
  "END_OF_NEXT_MONTH",
]

export interface SystemPaymentTerm {
  code: string
  name: string
  method: PaymentTermMethod
  days: number
  sortOrder: number
}

export const SYSTEM_PAYMENT_TERMS: readonly SystemPaymentTerm[] = [
  { code: "DUE_ON_RECEIPT", name: "Due on receipt", method: "DUE_ON_RECEIPT", days: 0, sortOrder: 1 },
  { code: "NET_15", name: "Net 15", method: "NET_DAYS", days: 15, sortOrder: 2 },
  { code: "NET_30", name: "Net 30", method: "NET_DAYS", days: 30, sortOrder: 3 },
  { code: "NET_45", name: "Net 45", method: "NET_DAYS", days: 45, sortOrder: 4 },
  { code: "NET_60", name: "Net 60", method: "NET_DAYS", days: 60, sortOrder: 5 },
  { code: "EOM", name: "Due end of month", method: "END_OF_MONTH", days: 0, sortOrder: 6 },
  { code: "NEXT_EOM", name: "Due end of next month", method: "END_OF_NEXT_MONTH", days: 0, sortOrder: 7 },
] as const

/** Fallback when neither the supplier nor the organization names a default term. */
export const DEFAULT_PAYMENT_TERM_CODE = "DUE_ON_RECEIPT"

export const PAYMENT_TERM_AUDIT_EVENTS = {
  CREATED: "payment_term.created",
  UPDATED: "payment_term.updated",
} as const
