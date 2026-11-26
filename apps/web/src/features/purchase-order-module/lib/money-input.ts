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

/**
 * Convert a percentage a user types ("14", "7.5", "12.34") into integer basis points ("1400").
 * Accepts 0 to 100 with at most two decimals; returns null otherwise.
 */
export function percentToBps(input: string): number | null {
  const cleaned = input.trim()
  if (cleaned === "") return 0
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole = "0", frac = ""] = cleaned.split(".")
  const bps = Number(whole) * 100 + Number(frac.padEnd(2, "0"))
  return bps > 10000 ? null : bps
}

/** Basis points back to the percentage shown in the UI ("1400" -> "14", 750 -> "7.5"). */
export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100)
  const frac = String(bps % 100).padStart(2, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : String(whole)
}
