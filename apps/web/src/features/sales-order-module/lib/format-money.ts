/**
 * Contracts carry money as integer minor-unit strings ("12500" = 125.00).
 * Formatting is display only; never parse these into floats for arithmetic.
 */
export function formatMinorAmount(minor: string, currency: string, locale?: string): string {
  const digits = (() => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    } catch {
      return 2
    }
  })()
  const negative = minor.startsWith("-")
  const raw = negative ? minor.slice(1) : minor
  const padded = raw.padStart(digits + 1, "0")
  const whole = padded.slice(0, padded.length - digits)
  const frac = digits > 0 ? padded.slice(padded.length - digits) : ""
  const wholeFmt = new Intl.NumberFormat(locale).format(BigInt(whole))
  const sep = digits > 0 ? "." : ""
  return `${negative ? "-" : ""}${wholeFmt}${sep}${frac} ${currency}`
}
