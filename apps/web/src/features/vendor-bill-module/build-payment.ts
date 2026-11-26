import { toMinorUnits } from "../purchase-order-module/lib/money-input"

export type PayChoice = "later" | "paid" | "partial"

export type PaymentPlan =
  | { ok: true; amountMinor: string | null }
  | { ok: false; reason: "amount" }

/**
 * Turns the "how is this bill paid" choice into the payment to record after posting.
 * `null` means no payment (pay later). The amount must be > 0 and <= the bill total.
 */
export function planPayment(
  choice: PayChoice,
  typedAmount: string,
  totalMinor: string,
  digits: number
): PaymentPlan {
  if (choice === "later") return { ok: true, amountMinor: null }
  if (choice === "paid") return { ok: true, amountMinor: totalMinor }
  const minor = toMinorUnits(typedAmount, digits)
  if (minor === null || BigInt(minor) <= 0n || BigInt(minor) > BigInt(totalMinor)) {
    return { ok: false, reason: "amount" }
  }
  return { ok: true, amountMinor: minor }
}
