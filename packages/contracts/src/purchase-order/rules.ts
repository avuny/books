import type { PurchaseOrderStatus } from "./constants.js"

/**
 * Pure purchase order rules shared by the API and the web app. Quantities are decimal strings
 * in the item's base unit; amounts are integer minor units. No Node, DOM or DB dependencies.
 */

/* ---------- decimal string helpers (exact, BigInt based) ---------- */

type Parsed = { n: bigint; scale: number }

const parse = (s: string): Parsed => {
  const negative = s.startsWith("-")
  const [int = "0", frac = ""] = (negative ? s.slice(1) : s).split(".")
  const n = BigInt((int || "0") + frac)
  return { n: negative ? -n : n, scale: frac.length }
}

const align = (a: Parsed, b: Parsed) => {
  const scale = Math.max(a.scale, b.scale)
  const lift = (p: Parsed) => p.n * 10n ** BigInt(scale - p.scale)
  return { x: lift(a), y: lift(b), scale }
}

const format = (n: bigint, scale: number): string => {
  const negative = n < 0n
  const abs = negative ? -n : n
  const digits = abs.toString().padStart(scale + 1, "0")
  let body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  if (body.includes(".")) body = body.replace(/0+$/, "").replace(/\.$/, "")
  return negative && body !== "0" ? `-${body}` : body
}

export const addQty = (a: string, b: string): string => {
  const { x, y, scale } = align(parse(a), parse(b))
  return format(x + y, scale)
}
export const subQty = (a: string, b: string): string => {
  const { x, y, scale } = align(parse(a), parse(b))
  return format(x - y, scale)
}
export const mulQty = (a: string, b: string): string => {
  const pa = parse(a)
  const pb = parse(b)
  return format(pa.n * pb.n, pa.scale + pb.scale)
}
export const cmpQty = (a: string, b: string): -1 | 0 | 1 => {
  const { x, y } = align(parse(a), parse(b))
  return x < y ? -1 : x > y ? 1 : 0
}
export const isPositiveQty = (a: string): boolean => cmpQty(a, "0") === 1

/* ---------- money ---------- */

/** Gross line amount in minor units: quantity x unit price, rounded half up. */
export function computeLineGross(orderedQty: string, unitPriceMinor: string): bigint {
  const { n, scale } = parse(mulQty(orderedQty, unitPriceMinor))
  const divisor = 10n ** BigInt(scale)
  if (scale === 0) return n
  return (n * 2n + divisor) / (divisor * 2n)
}

export interface LineAmounts {
  gross: bigint
  discount: bigint
  net: bigint
}

export function computeLineAmounts(
  orderedQty: string,
  unitPriceMinor: string,
  discountMinor: string
): LineAmounts {
  const gross = computeLineGross(orderedQty, unitPriceMinor)
  const discount = BigInt(discountMinor)
  return { gross, discount, net: gross - discount }
}

export function sumLineAmounts(lines: readonly LineAmounts[]) {
  return lines.reduce(
    (acc, l) => ({
      subtotal: acc.subtotal + l.gross,
      discount: acc.discount + l.discount,
      total: acc.total + l.net,
    }),
    { subtotal: 0n, discount: 0n, total: 0n }
  )
}

/* ---------- line quantity derivations (SPEC 3.3) ---------- */

export interface LineCounters {
  orderedBaseQty: string
  cancelledBaseQty: string
  shippedBaseQty: string
  receivedBaseQty: string
}

export const unshippedBaseQty = (l: LineCounters) =>
  subQty(subQty(l.orderedBaseQty, l.cancelledBaseQty), l.shippedBaseQty)

export const inTransitBaseQty = (l: LineCounters) => subQty(l.shippedBaseQty, l.receivedBaseQty)

export const unreceivedBaseQty = (l: LineCounters) =>
  subQty(subQty(l.orderedBaseQty, l.cancelledBaseQty), l.receivedBaseQty)

/**
 * Header status after a posting event (SPEC 3.3 precedence). `current` carries the explicit
 * lifecycle: DRAFT, CLOSED and CANCELLED are never derived away.
 */
export function derivePurchaseOrderStatus(
  current: PurchaseOrderStatus,
  lines: readonly LineCounters[]
): PurchaseOrderStatus {
  if (current === "DRAFT" || current === "CLOSED" || current === "CANCELLED") return current
  const active = lines.filter((l) => isPositiveQty(subQty(l.orderedBaseQty, l.cancelledBaseQty)))
  if (active.length === 0) return "CONFIRMED"
  const anyReceived = active.some((l) => isPositiveQty(l.receivedBaseQty))
  const allReceived = active.every((l) => cmpQty(unreceivedBaseQty(l), "0") <= 0)
  if (allReceived) return "RECEIVED"
  if (anyReceived) return "PARTIALLY_RECEIVED"
  const anyShipped = active.some((l) => isPositiveQty(l.shippedBaseQty))
  if (!anyShipped) return "CONFIRMED"
  const anyUnshipped = active.some((l) => isPositiveQty(unshippedBaseQty(l)))
  return anyUnshipped ? "PARTIALLY_SHIPPED" : "IN_TRANSIT"
}
