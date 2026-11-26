/** Pure vendor payment rules shared by the API and the web app. Amounts are integer minor units. */
import type { BillPaymentStatus } from "./constants.js"

export function computeOutstanding(totalMinor: string, paidMinor: string): bigint {
  const left = BigInt(totalMinor) - BigInt(paidMinor)
  return left > 0n ? left : 0n
}

export function deriveBillPaymentStatus(billStatus: "DRAFT" | "POSTED" | "REVERSED", totalMinor: string, paidMinor: string): BillPaymentStatus | null {
  if (billStatus !== "POSTED") return null
  const paid = BigInt(paidMinor)
  if (paid <= 0n) return "UNPAID"
  return paid >= BigInt(totalMinor) ? "PAID" : "PARTIALLY_PAID"
}

export const sumAllocations = (allocations: readonly { amountMinor: string }[]): bigint =>
  allocations.reduce((sum, a) => sum + BigInt(a.amountMinor), 0n)

/** True when the bill is posted, not fully paid and past its due date on `today` (YYYY-MM-DD). */
export const isOverdue = (dueDate: string, outstandingMinor: string, today: string): boolean =>
  BigInt(outstandingMinor) > 0n && dueDate < today
