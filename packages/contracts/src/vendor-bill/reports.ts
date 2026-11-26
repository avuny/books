import { z } from "@avuny/zod"

/** Accounts payable reports. All amounts are integer minor-unit strings; sums use BigInt. */

export const AP_AGING_BUCKETS = ["CURRENT", "DAYS_1_30", "DAYS_31_60", "DAYS_61_90", "OVER_90"] as const
export type ApAgingBucket = (typeof AP_AGING_BUCKETS)[number]

const msPerDay = 86_400_000
const dayNumber = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / msPerDay)

/** Whole days a bill is past due on `asOf` (0 or less means not yet due). */
export function daysPastDue(dueDate: string, asOf: string): number {
  return dayNumber(asOf) - dayNumber(dueDate)
}

/** Bucket by days past DUE date: not yet due is CURRENT. */
export function agingBucketFor(dueDate: string, asOf: string): ApAgingBucket {
  const d = daysPastDue(dueDate, asOf)
  if (d <= 0) return "CURRENT"
  if (d <= 30) return "DAYS_1_30"
  if (d <= 60) return "DAYS_31_60"
  if (d <= 90) return "DAYS_61_90"
  return "OVER_90"
}

export interface AgingInputBill {
  id: string
  number: string
  partyId: string
  partyName: string | null
  currency: string
  dueDate: string
  outstanding: string
}

const emptyBuckets = (): Record<ApAgingBucket, bigint> => ({
  CURRENT: 0n,
  DAYS_1_30: 0n,
  DAYS_31_60: 0n,
  DAYS_61_90: 0n,
  OVER_90: 0n,
})

/** Groups open bills by supplier and currency into aging buckets. Bills with nothing outstanding are skipped. */
export function buildApAging(bills: readonly AgingInputBill[], asOf: string): ApAgingResponse {
  const groups = new Map<string, { partyId: string; partyName: string | null; currency: string; b: Record<ApAgingBucket, bigint> }>()
  for (const bill of bills) {
    const amount = BigInt(bill.outstanding)
    if (amount <= 0n) continue
    const key = `${bill.partyId}|${bill.currency}`
    const g = groups.get(key) ?? { partyId: bill.partyId, partyName: bill.partyName, currency: bill.currency, b: emptyBuckets() }
    g.b[agingBucketFor(bill.dueDate, asOf)] += amount
    groups.set(key, g)
  }
  const rows = [...groups.values()]
    .map((g) => {
      const total = AP_AGING_BUCKETS.reduce((s, k) => s + g.b[k], 0n)
      return {
        partyId: g.partyId,
        partyName: g.partyName,
        currency: g.currency,
        buckets: Object.fromEntries(AP_AGING_BUCKETS.map((k) => [k, String(g.b[k])])) as Record<ApAgingBucket, string>,
        total: String(total),
      }
    })
    .sort((a, b) => (a.partyName ?? "").localeCompare(b.partyName ?? "") || a.currency.localeCompare(b.currency))
  return { asOf, rows }
}

export interface StatementInputRow {
  kind: "BILL" | "PAYMENT"
  date: string
  number: string
  reference: string | null
  /** Positive minor units. A bill increases what is owed, a payment decreases it. */
  amount: string
}

/** Orders activity by date (bills before payments on the same day) and adds a running balance. */
export function buildStatement(
  rows: readonly StatementInputRow[],
  openingBalance: string
): { lines: StatementLine[]; closingBalance: string } {
  const sorted = [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.number.localeCompare(b.number) : a.kind === "BILL" ? -1 : 1)
  )
  let balance = BigInt(openingBalance)
  const lines = sorted.map((r) => {
    const amount = BigInt(r.amount)
    balance += r.kind === "BILL" ? amount : -amount
    return {
      kind: r.kind,
      date: r.date,
      number: r.number,
      reference: r.reference,
      charge: r.kind === "BILL" ? r.amount : "0",
      payment: r.kind === "PAYMENT" ? r.amount : "0",
      balance: String(balance),
    }
  })
  return { lines, closingBalance: String(balance) }
}

/** Difference between a ledger balance and the subledger it should equal. */
export const reconcileAmounts = (ledger: string, subledger: string) => ({
  ledger,
  subledger,
  difference: String(BigInt(ledger) - BigInt(subledger)),
  balanced: BigInt(ledger) === BigInt(subledger),
})

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const minor = z.string().regex(/^-?\d+$/)

export const ApAgingRowSchema = z.object({
  partyId: z.string().uuid(),
  partyName: z.string().nullable(),
  currency: z.string(),
  buckets: z.object({
    CURRENT: minor,
    DAYS_1_30: minor,
    DAYS_31_60: minor,
    DAYS_61_90: minor,
    OVER_90: minor,
  }),
  total: minor,
})
export const ApAgingResponseSchema = z.object({ asOf: date, rows: z.array(ApAgingRowSchema) })
export type ApAgingResponse = z.infer<typeof ApAgingResponseSchema>

export const SupplierStatementQuerySchema = z.object({
  partyId: z.string().uuid(),
  from: date.optional(),
  to: date.optional(),
})
export const StatementLineSchema = z.object({
  kind: z.enum(["BILL", "PAYMENT"]),
  date,
  number: z.string(),
  reference: z.string().nullable(),
  charge: minor,
  payment: minor,
  balance: minor,
})
export type StatementLine = z.infer<typeof StatementLineSchema>
export const SupplierStatementResponseSchema = z.object({
  partyId: z.string().uuid(),
  partyName: z.string().nullable(),
  currency: z.string().nullable(),
  from: date.nullable(),
  to: date.nullable(),
  openingBalance: minor,
  closingBalance: minor,
  lines: z.array(StatementLineSchema),
})
export type SupplierStatementResponse = z.infer<typeof SupplierStatementResponseSchema>

const ReconciliationSideSchema = z.object({
  ledger: minor,
  subledger: minor,
  difference: minor,
  balanced: z.boolean(),
})
export const ApReconciliationResponseSchema = z.object({
  /** Ledger: credits less debits on the Accounts Payable account. Subledger: outstanding on posted bills. */
  accountsPayable: ReconciliationSideSchema,
  /** Ledger: credits less debits on GRNI. Subledger: posted receipt value less value cleared by posted bills. */
  goodsReceivedNotInvoiced: ReconciliationSideSchema,
})
export type ApReconciliationResponse = z.infer<typeof ApReconciliationResponseSchema>
