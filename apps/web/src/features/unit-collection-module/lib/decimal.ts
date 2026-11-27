/**
 * "0.010000000000" -> "0.01", "1.000000000000" -> "1": the API returns numeric columns
 * padded to their scale. Strings only: never go through JS floats.
 */
export function trimDecimal(value: string): string {
  const [rawInt = "", rawFrac = ""] = value.trim().split(".")
  const int = rawInt.replace(/^0+(?=\d)/, "") || "0"
  const frac = rawFrac.replace(/0+$/, "")
  return frac ? `${int}.${frac}` : int
}

/** Same shape as the API's conversion factor: up to 12 integer and 12 fraction digits. */
const POSITIVE_DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,12})?$/

/** A decimal string that fits numeric(24, 12) and is greater than zero. */
export function isPositiveDecimal(value: string): boolean {
  const v = value.trim()
  return POSITIVE_DECIMAL_PATTERN.test(v) && /[1-9]/.test(v)
}

/**
 * True for valid positive decimal strings below 1 ("0.02").
 * String check only: a trimmed positive decimal < 1 always renders "0.xxx".
 */
export function isLessThanOne(value: string): boolean {
  return trimDecimal(value).startsWith("0.")
}

function parseDecimal(value: string): { digits: bigint; scale: number } {
  const [int = "", frac = ""] = trimDecimal(value).split(".")
  return { digits: BigInt(int + frac), scale: frac.length }
}

/**
 * numerator / denominator as a decimal string with at most `scale` fraction digits,
 * rounded half-up. Returns null unless both inputs are positive decimals; returns "0"
 * when the true result is too small to represent at `scale` (callers treat that as invalid).
 * BigInt only: never goes through JS floats.
 */
export function divideDecimals(
  numerator: string,
  denominator: string,
  scale = 12
): string | null {
  if (!isPositiveDecimal(numerator) || !isPositiveDecimal(denominator)) return null
  const n = parseDecimal(numerator)
  const d = parseDecimal(denominator)
  // value = (n.digits / 10^n.scale) / (d.digits / 10^d.scale)
  const scaledNumerator = n.digits * 10n ** BigInt(d.scale + scale)
  const divisor = d.digits * 10n ** BigInt(n.scale)
  let quotient = scaledNumerator / divisor
  const remainder = scaledNumerator % divisor
  if (remainder * 2n >= divisor) quotient += 1n
  const raw = quotient.toString().padStart(scale + 1, "0")
  const int = raw.slice(0, -scale) || "0"
  const frac = raw.slice(-scale)
  return trimDecimal(`${int}.${frac}`)
}

/** 1 / value, e.g. "0.02" -> "50". Same rules as divideDecimals. */
export function reciprocalDecimal(value: string): string | null {
  return divideDecimals("1", value)
}

/**
 * The clean side of a stored factor for display: factors below 1 read better as
 * "1 base = N units" ("0.02" -> "50"), but only when the reciprocal is short enough
 * to stay readable ("0.333333333333" stays as is).
 */
export function friendlyReciprocal(
  factor: string,
  maxFractionDigits = 6
): string | null {
  if (!isPositiveDecimal(factor) || !isLessThanOne(factor)) return null
  const inverse = reciprocalDecimal(factor)
  if (!inverse || inverse === "0") return null
  const frac = inverse.split(".")[1] ?? ""
  return frac.length <= maxFractionDigits ? inverse : null
}
