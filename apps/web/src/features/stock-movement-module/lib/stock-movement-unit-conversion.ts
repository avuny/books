/**
 * Unit conversion arithmetic for Stock Movements.
 * Decimal string operations preserving precision up to 6 decimal places without float rounding errors.
 */

export const parseDecimal = (s: string) => {
  const trimmed = s.trim()
  const negative = trimmed.startsWith("-")
  const str = negative ? trimmed.slice(1) : trimmed
  const [int = "0", frac = ""] = str.split(".")
  const n = BigInt(int + frac)
  return { n: negative ? -n : n, scale: frac.length }
}

export const formatDecimal = (n: bigint, scale: number): string => {
  const negative = n < 0n
  const abs = negative ? -n : n
  const digits = abs.toString().padStart(scale + 1, "0")
  const body =
    scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  return negative ? `-${body}` : body
}

export function divideDecimal(a: string, b: string, precision = 6): string {
  const pa = parseDecimal(a)
  const pb = parseDecimal(b)
  if (pb.n === 0n) return a
  const extraScale = precision + pb.scale - pa.scale
  const scaledNum =
    extraScale >= 0
      ? pa.n * 10n ** BigInt(extraScale)
      : pa.n / 10n ** BigInt(-extraScale)
  return formatDecimal(scaledNum / pb.n, precision)
}

export function multiplyDecimal(a: string, b: string): string {
  const pa = parseDecimal(a)
  const pb = parseDecimal(b)
  return formatDecimal(pa.n * pb.n, pa.scale + pb.scale)
}

/**
 * Trims leading/trailing zeros, e.g. "100.000000" -> "100", "0.0100" -> "0.01", "-0.50" -> "-0.5".
 */
export function trimDecimal(value: string): string {
  if (!value) return "0"
  const trimmed = value.trim()
  const negative = trimmed.startsWith("-")
  const clean = negative ? trimmed.slice(1) : trimmed
  const [rawInt = "", rawFrac = ""] = clean.split(".")
  const int = rawInt.replace(/^0+(?=\d)/, "") || "0"
  const frac = rawFrac.replace(/0+$/, "")
  const res = frac ? `${int}.${frac}` : int
  return negative && res !== "0" ? `-${res}` : res
}

/**
 * Converts a quantity from base units to the selected display unit.
 * Formula: displayQty = baseQty / conversionFactor.
 */
export function convertQuantityFromBase(
  baseQuantity: string,
  conversionFactor: string
): string {
  if (!baseQuantity || !conversionFactor) return baseQuantity || "0"
  const trimmedFactor = trimDecimal(conversionFactor)
  if (trimmedFactor === "1" || trimmedFactor === "0") {
    return trimDecimal(baseQuantity)
  }
  const result = divideDecimal(baseQuantity, conversionFactor, 6)
  return trimDecimal(result)
}

/**
 * Converts a quantity from a display unit to base units.
 * Formula: baseQty = displayQty * conversionFactor.
 */
export function convertQuantityToBase(
  displayQuantity: string,
  conversionFactor: string
): string {
  if (!displayQuantity || !conversionFactor) return displayQuantity || "0"
  const trimmedFactor = trimDecimal(conversionFactor)
  if (trimmedFactor === "1" || trimmedFactor === "0") {
    return trimDecimal(displayQuantity)
  }
  const result = multiplyDecimal(displayQuantity, conversionFactor)
  return trimDecimal(result)
}
