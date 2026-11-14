import {
  WAREHOUSE_LOCATION_SYSTEM_ROLES,
  type WarehouseLocationPostingIntent,
} from "../warehouse-location/constants.js"
import { STOCK_MOVEMENT_QUANTITY_REGEX, type StockMovementType } from "./constants.js"
import { StockMovementErrorCode as Err } from "./errors.js"

/* ---------- decimal strings ---------- */
// Quantities are numeric strings and are never converted to number. These helpers add and
// compare them exactly (bigint scaled to the longer fraction), so the service needs no decimal library.

type Parsed = { n: bigint; scale: number }

const parse = (s: string): Parsed => {
  const negative = s.startsWith("-")
  const [int = "0", frac = ""] = (negative ? s.slice(1) : s).split(".")
  const n = BigInt(int + frac)
  return { n: negative ? -n : n, scale: frac.length }
}

const align = (a: Parsed, b: Parsed) => {
  const scale = Math.max(a.scale, b.scale)
  const lift = (p: Parsed) => p.n * 10n ** BigInt(scale - p.scale)
  return { x: lift(a), y: lift(b), scale }
}

const format = (n: bigint, scale: number): string => {
  const negative = n < 0n
  const digits = (negative ? -n : n).toString().padStart(scale + 1, "0")
  const body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  return negative ? `-${body}` : body
}

export const compareDecimal = (a: string, b: string): -1 | 0 | 1 => {
  const { x, y } = align(parse(a), parse(b))
  return x < y ? -1 : x > y ? 1 : 0
}

export const addDecimal = (a: string, b: string): string => {
  const { x, y, scale } = align(parse(a), parse(b))
  return format(x + y, scale)
}

export const negateDecimal = (a: string): string => {
  const p = parse(a)
  return format(-p.n, p.scale)
}

export const isPositiveQuantity = (q: string): boolean => STOCK_MOVEMENT_QUANTITY_REGEX.test(q)

/** Key of one stock balance row: a location, an item and (for batch-tracked items) a batch. */
export const balanceKey = (locationId: string, itemId: string, batchId?: string | null): string =>
  `${locationId}:${itemId}:${batchId ?? ""}`

/* ---------- from / to sides ---------- */

export type StockSystemRole = (typeof WAREHOUSE_LOCATION_SYSTEM_ROLES)[number]
/** System location id per role for one organization (seeded with the organization). */
export type SystemLocationIds = Partial<Record<StockSystemRole, string>>

/**
 * A side is either filled by the system with a counterparty location (the other end of the
 * movement, outside any building), or supplied by the caller and then checked for this posting intent.
 */
type Side = { role: StockSystemRole } | { intent: WarehouseLocationPostingIntent }

const SIDES: Readonly<Record<Exclude<StockMovementType, "adjustment">, { from: Side; to: Side }>> = {
  opening: { from: { role: "adjustment" }, to: { intent: "receive" } },
  purchase: { from: { role: "supplier" }, to: { intent: "receive" } },
  purchase_return: { from: { intent: "issue" }, to: { role: "supplier" } },
  sale: { from: { intent: "issue" }, to: { role: "customer" } },
  sale_return: { from: { role: "customer" }, to: { intent: "receive" } },
  transfer: { from: { intent: "move_out" }, to: { intent: "move_in" } },
  assembly_consume: { from: { intent: "issue" }, to: { role: "production" } },
  assembly_produce: { from: { role: "production" }, to: { intent: "receive" } },
}

export type ResolvedSides = {
  fromLocationId: string
  toLocationId: string
  /** null = counterparty side: no postability check and no stock balance. */
  fromIntent: WarehouseLocationPostingIntent | null
  toIntent: WarehouseLocationPostingIntent | null
}
export type SideResolution =
  | { ok: true; value: ResolvedSides }
  | { ok: false; error: Err }

type Resolved = { id: string; intent: WarehouseLocationPostingIntent | null }

const resolveSide = (
  side: Side,
  given: string | null,
  system: SystemLocationIds
): Resolved | Err => {
  if ("role" in side) {
    if (given !== null) return Err.STOCK_MOVEMENT_INVALID_SIDES // the system owns this side
    const id = system[side.role]
    return id ? { id, intent: null } : Err.STOCK_MOVEMENT_SYSTEM_LOCATION_MISSING
  }
  return given ? { id: given, intent: side.intent } : Err.STOCK_MOVEMENT_INVALID_SIDES
}

/**
 * Turns what the caller supplied into the two real locations of a movement line.
 * - adjustment: exactly one side is given (gain = to, loss = from); the other is the ADJUSTMENT location.
 * - every other type: the counterparty side must be omitted and is filled from the system locations.
 * - from and to can never be the same location.
 */
export function resolveSides(
  type: StockMovementType,
  line: { fromLocationId?: string | null; toLocationId?: string | null },
  system: SystemLocationIds
): SideResolution {
  const from = line.fromLocationId ?? null
  const to = line.toLocationId ?? null

  let fromSide: Side
  let toSide: Side
  if (type === "adjustment") {
    if ((from === null) === (to === null)) return { ok: false, error: Err.STOCK_MOVEMENT_INVALID_SIDES }
    fromSide = from === null ? { role: "adjustment" } : { intent: "adjust" }
    toSide = to === null ? { role: "adjustment" } : { intent: "adjust" }
  } else {
    fromSide = SIDES[type].from
    toSide = SIDES[type].to
  }

  const f = resolveSide(fromSide, from, system)
  if (typeof f === "string") return { ok: false, error: f }
  const t = resolveSide(toSide, to, system)
  if (typeof t === "string") return { ok: false, error: t }
  if (f.id === t.id) return { ok: false, error: Err.STOCK_MOVEMENT_SAME_LOCATION }

  return {
    ok: true,
    value: { fromLocationId: f.id, toLocationId: t.id, fromIntent: f.intent, toIntent: t.intent },
  }
}
