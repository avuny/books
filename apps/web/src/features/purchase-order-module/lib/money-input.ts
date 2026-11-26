/**
 * Convert what a user types ("125.5", "1,200") into integer minor units as a
 * string ("12550"). Pure string math, so no float rounding. Returns null for
 * anything that is not a plain non-negative decimal within `digits` places.
 */
export function toMinorUnits(input: string, digits: number): string | null {
  const cleaned = input.trim().replace(/,/g, "")
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const [whole = "0", frac = ""] = cleaned.split(".")
  if (frac.length > digits) return null
  const minor = (whole + frac.padEnd(digits, "0")).replace(/^0+(?=\d)/, "")
  return minor
}

/** Decimal places of a currency, from Intl (2 when unknown). */
export function currencyDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    )
  } catch {
    return 2
  }
}
