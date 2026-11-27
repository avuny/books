import { toMinorUnits } from "../purchase-order-module/lib/money-input"

export type PayChoice = "full" | "partial"

/** The minor amount to receive, or null when a typed partial amount is not > 0 and <= the outstanding amount. */
export function planPayment(choice: PayChoice, typedAmount: string, outstandingMinor: string, digits: number): string | null {
  if (choice === "full") return BigInt(outstandingMinor) > 0n ? outstandingMinor : null
  const minor = toMinorUnits(typedAmount, digits)
  if (minor === null || BigInt(minor) <= 0n || BigInt(minor) > BigInt(outstandingMinor)) return null
  return minor
}
