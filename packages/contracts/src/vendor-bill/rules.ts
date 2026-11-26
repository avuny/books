/**
 * Pure vendor bill rules shared by the API and the web app. Quantities are decimal strings in the
 * receipt line's unit or base unit (at most 6 decimals); amounts are integer minor units.
 */
import { computeReceiptValue } from "../purchase-receipt/rules.js"
import { RECEIPT_BILL_STATUSES, type ReceiptBillStatus } from "./constants.js"

const QTY_SCALE = 6
const scaled = (qty: string): bigint => {
  const [int = "0", frac = ""] = qty.split(".")
  return BigInt((int || "0") + frac.padEnd(QTY_SCALE, "0").slice(0, QTY_SCALE))
}

/** Tax on a net amount at a basis-point rate, rounded half up. */
export function computeBillLineTax(netMinor: string, taxRateBps: number): bigint {
  return (BigInt(netMinor) * BigInt(taxRateBps) * 2n + 10_000n) / 20_000n
}

/**
 * The part of a receipt line's value that this bill takes out of GRNI: billed / accepted x receipt value.
 * Billing the whole accepted quantity carries exactly the receipt value, so a bill at the receipt price has no variance.
 */
export function computeMatchedValue(billedBaseQty: string, acceptedBaseQty: string, receiptValueMinor: string): bigint {
  return computeReceiptValue(billedBaseQty, acceptedBaseQty, receiptValueMinor)
}

export interface BillTotalsLine {
  netMinor: string
  taxRateBps: number
  matchedValueMinor?: string
}

/** Header totals. Tax is rounded per line. Variance = invoiced goods - received goods (positive means we pay more than we booked). */
export function computeBillTotals(lines: readonly BillTotalsLine[]) {
  let subtotal = 0n
  let tax = 0n
  let matched = 0n
  for (const l of lines) {
    subtotal += BigInt(l.netMinor)
    tax += computeBillLineTax(l.netMinor, l.taxRateBps)
    matched += BigInt(l.matchedValueMinor ?? "0")
  }
  return { subtotal, tax, total: subtotal + tax, matched, variance: subtotal - matched }
}

/** Billed state of one receipt from its accepted and posted-billed base quantities per line. */
export function deriveReceiptBillStatus(
  receiptStatus: "DRAFT" | "POSTED" | "REVERSED",
  lines: readonly { acceptedBaseQty: string; billedBaseQty: string }[]
): ReceiptBillStatus {
  if (receiptStatus !== "POSTED") return "NOT_APPLICABLE"
  const accepted = lines.filter((l) => scaled(l.acceptedBaseQty) > 0n)
  if (accepted.length === 0) return "NOT_APPLICABLE"
  if (accepted.every((l) => scaled(l.billedBaseQty) >= scaled(l.acceptedBaseQty))) return "BILLED"
  if (accepted.some((l) => scaled(l.billedBaseQty) > 0n)) return "PARTIALLY_BILLED"
  return "AWAITING_BILL"
}

export const isReceiptBillStatus = (v: string): v is ReceiptBillStatus =>
  (RECEIPT_BILL_STATUSES as readonly string[]).includes(v)
