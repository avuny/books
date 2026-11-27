import { z } from "@avuny/zod"
import { buildApAging, reconcileAmounts, AP_AGING_BUCKETS, type AgingInputBill } from "../vendor-bill/reports.js"

/**
 * Accounts receivable reports. Same bucket rules as AP aging (days past DUE date), so the two reports agree.
 * All amounts are integer minor-unit strings; sums use BigInt.
 */

export const AR_AGING_BUCKETS = AP_AGING_BUCKETS
export type ArAgingInputInvoice = AgingInputBill

/** Groups open invoices by customer and currency into aging buckets. Fully paid invoices are skipped. */
export function buildArAging(invoices: readonly ArAgingInputInvoice[], asOf: string): ArAgingResponse {
  return buildApAging(invoices, asOf)
}

export const reconcileReceivable = reconcileAmounts

export interface CustomerStatementInputRow {
  kind: "INVOICE" | "PAYMENT" | "CREDIT_NOTE"
  date: string
  number: string
  reference: string | null
  /** Positive minor units. An invoice increases what the customer owes, a payment or credit note decreases it. */
  amount: string
}

/** Orders activity by date (invoices first on the same day) and adds a running balance. */
export function buildCustomerStatement(
  rows: readonly CustomerStatementInputRow[],
  openingBalance: string
): { lines: CustomerStatementLine[]; closingBalance: string } {
  const sorted = [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.number.localeCompare(b.number) : a.kind === "INVOICE" ? -1 : 1)
  )
  let balance = BigInt(openingBalance)
  const lines = sorted.map((r) => {
    const amount = BigInt(r.amount)
    balance += r.kind === "INVOICE" ? amount : -amount
    return {
      kind: r.kind,
      date: r.date,
      number: r.number,
      reference: r.reference,
      charge: r.kind === "INVOICE" ? r.amount : "0",
      payment: r.kind === "INVOICE" ? "0" : r.amount,
      balance: String(balance),
    }
  })
  return { lines, closingBalance: String(balance) }
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const minor = z.string().regex(/^-?\d+$/)

export const ArAgingRowSchema = z.object({
  partyId: z.string().uuid(),
  partyName: z.string().nullable(),
  currency: z.string(),
  buckets: z.object({ CURRENT: minor, DAYS_1_30: minor, DAYS_31_60: minor, DAYS_61_90: minor, OVER_90: minor }),
  total: minor,
})
export const ArAgingResponseSchema = z.object({ asOf: date, rows: z.array(ArAgingRowSchema) })
export type ArAgingResponse = z.infer<typeof ArAgingResponseSchema>

export const CustomerStatementQuerySchema = z.object({ partyId: z.string().uuid(), from: date.optional(), to: date.optional() })
export const CustomerStatementLineSchema = z.object({
  kind: z.enum(["INVOICE", "PAYMENT", "CREDIT_NOTE"]),
  date,
  number: z.string(),
  reference: z.string().nullable(),
  charge: minor,
  payment: minor,
  balance: minor,
})
export type CustomerStatementLine = z.infer<typeof CustomerStatementLineSchema>
export const CustomerStatementResponseSchema = z.object({
  partyId: z.string().uuid(),
  partyName: z.string().nullable(),
  currency: z.string().nullable(),
  from: date.nullable(),
  to: date.nullable(),
  openingBalance: minor,
  closingBalance: minor,
  lines: z.array(CustomerStatementLineSchema),
})
export type CustomerStatementResponse = z.infer<typeof CustomerStatementResponseSchema>

export const ArReconciliationResponseSchema = z.object({
  /** Ledger: debits less credits on the Accounts Receivable account. Subledger: outstanding on posted invoices. */
  accountsReceivable: z.object({ ledger: minor, subledger: minor, difference: minor, balanced: z.boolean() }),
})
export type ArReconciliationResponse = z.infer<typeof ArReconciliationResponseSchema>
