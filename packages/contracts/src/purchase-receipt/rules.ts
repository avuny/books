/**
 * Pure goods receipt rules shared by the API and the web app. Quantities are decimal strings in the
 * item's base unit (at most 6 decimals); amounts are integer minor units. No Node, DOM or DB dependencies.
 */

const QTY_SCALE = 6

const scaled = (qty: string): bigint => {
  const [int = "0", frac = ""] = qty.split(".")
  return BigInt((int || "0") + frac.padEnd(QTY_SCALE, "0").slice(0, QTY_SCALE))
}

/**
 * Value of the accepted quantity of one order line, in minor units: accepted / ordered x the line net
 * amount (after discount, before tax), rounded half up. A line received in full carries exactly its net amount.
 */
export function computeReceiptValue(acceptedBaseQty: string, orderedBaseQty: string, lineNetAmountMinor: string): bigint {
  const ordered = scaled(orderedBaseQty)
  if (ordered <= 0n) return 0n
  const num = scaled(acceptedBaseQty) * BigInt(lineNetAmountMinor)
  return (num * 2n + ordered) / (ordered * 2n)
}

/** Net price of one base unit in minor units, rounded half up. Informational snapshot only. */
export function computeUnitCostSnapshot(orderedBaseQty: string, lineNetAmountMinor: string): bigint {
  return computeReceiptValue("1", orderedBaseQty, lineNetAmountMinor)
}
