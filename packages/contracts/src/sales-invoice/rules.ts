/**
 * Pure sales invoice rules shared by the API and the web app. Quantities are decimal strings (at most 6 decimals);
 * amounts are integer minor units.
 */
import { SALES_INVOICE_PAYMENT_STATUSES, type SalesInvoicePaymentStatus } from "./constants.js"

const QTY_SCALE = 6
const scaled = (qty: string): bigint => {
  const [int = "0", frac = ""] = qty.split(".")
  return BigInt((int || "0") + frac.padEnd(QTY_SCALE, "0").slice(0, QTY_SCALE))
}

/** Tax on a net amount at a basis-point rate, rounded half up. */
export function computeInvoiceLineTax(netMinor: string, taxRateBps: number): bigint {
  return (BigInt(netMinor) * BigInt(taxRateBps) * 2n + 10_000n) / 20_000n
}

/**
 * The share of an order line amount that an invoiced base quantity carries: amount x invoiced / ordered, rounded half up.
 * Invoicing the whole ordered quantity carries exactly the order line amount.
 */
export function prorateAmount(amountMinor: string, invoicedBaseQty: string, orderedBaseQty: string): bigint {
  const ordered = scaled(orderedBaseQty)
  if (ordered <= 0n) return 0n
  const invoiced = scaled(invoicedBaseQty)
  if (invoiced >= ordered) return BigInt(amountMinor)
  return (BigInt(amountMinor) * invoiced * 2n + ordered) / (ordered * 2n)
}

export interface InvoiceTotalsLine {
  netMinor: string
  discountMinor: string
  taxRateBps: number
}

/** Header totals. Tax is rounded per line. `gross` is net plus discount (revenue before discount). */
export function computeInvoiceTotals(lines: readonly InvoiceTotalsLine[]) {
  let subtotal = 0n
  let discount = 0n
  let tax = 0n
  for (const l of lines) {
    subtotal += BigInt(l.netMinor)
    discount += BigInt(l.discountMinor)
    tax += computeInvoiceLineTax(l.netMinor, l.taxRateBps)
  }
  return { subtotal, discount, gross: subtotal + discount, tax, total: subtotal + tax }
}

/** Paid state from the invoice total and what posted payments applied. */
export function derivePaymentStatus(totalMinor: string, paidMinor: string): SalesInvoicePaymentStatus {
  const paid = BigInt(paidMinor)
  if (paid <= 0n) return "UNPAID"
  return paid >= BigInt(totalMinor) ? "PAID" : "PARTIALLY_PAID"
}

export const isSalesInvoicePaymentStatus = (v: string): v is SalesInvoicePaymentStatus =>
  (SALES_INVOICE_PAYMENT_STATUSES as readonly string[]).includes(v)
