/**
 * PURE unit math of items. Decimal strings only, BigInt arithmetic, never floats.
 * A conversion factor says how many BASE units one of a unit equals
 * (base_quantity = entered_quantity * factor), so a price per 1 unit divided by the
 * factor gives the price per 1 base unit.
 */

const SCALE = 6

type Parsed = { n: bigint; scale: number }

function parse(value: string): Parsed {
  const [int = "0", frac = ""] = value.trim().split(".")
  return { n: BigInt(`${int || "0"}${frac}`), scale: frac.length }
}

/** Rounds n / 10^drop half up (n >= 0). */
function roundDown(n: bigint, drop: number): bigint {
  if (drop <= 0) return n * 10n ** BigInt(-drop)
  const div = 10n ** BigInt(drop)
  const q = n / div
  return n % div * 2n >= div ? q + 1n : q
}

function format(n: bigint, scale: number): string {
  const digits = n.toString().padStart(scale + 1, "0")
  if (scale === 0) return digits
  const body = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  return body.replace(/0+$/, "").replace(/\.$/, "")
}

/** entered * factor, rounded half up to 6 decimals (the numeric(18, 6) of stored quantities). */
export function toBaseQuantity(entered: string, factor: string): string {
  const a = parse(entered)
  const b = parse(factor)
  const scale = a.scale + b.scale
  return format(roundDown(a.n * b.n, scale - SCALE), SCALE)
}

/** pricePerUnit / factor, rounded half up to 6 decimals: the price per 1 BASE unit. */
export function toBaseUnitPrice(pricePerUnit: string, factor: string): string {
  const a = parse(pricePerUnit)
  const b = parse(factor)
  if (b.n === 0n) throw new Error("Conversion factor must be greater than zero")
  // (a.n / 10^a.scale) / (b.n / 10^b.scale) = a.n * 10^b.scale / (b.n * 10^a.scale); target scale 6
  const num = a.n * 10n ** BigInt(b.scale + SCALE + 1)
  const den = b.n * 10n ** BigInt(a.scale)
  const q = num / den // one extra digit for rounding
  return format(roundDown(q, 1), SCALE)
}
