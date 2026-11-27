/**
 * Pure costing math (SPEC section 6.3). Exact BigInt arithmetic on millionths of a unit and on
 * integer minor units. No Number math on money, no floats, no rounding account.
 */
import {
  COST_MAX_VALUE_MINOR,
  COST_QUANTITY_SCALE,
  COST_UNIT_COST_SCALE,
  COST_VALUE_MINOR_REGEX,
  COST_DECIMAL_REGEX,
  COST_QUANTITY_REGEX,
} from "./constants.js"
import { InventoryCostingErrorCode as Err } from "./errors.js"

const MICRO = 10n ** BigInt(COST_QUANTITY_SCALE)

/** Quantity string (up to 6 decimals, not negative) to millionths. Throws on bad input. */
export const toMicro = (qty: string): bigint => {
  if (!COST_QUANTITY_REGEX.test(qty)) throw new Error(Err.COST_INVALID)
  const [int = "0", frac = ""] = qty.split(".")
  return BigInt(int) * MICRO + BigInt(frac.padEnd(COST_QUANTITY_SCALE, "0") || "0")
}

/** Millionths to a quantity string without trailing zeros in the fraction. */
export const fromMicro = (micro: bigint): string => {
  if (micro < 0n) throw new Error(Err.COST_INVALID)
  const int = micro / MICRO
  const frac = (micro % MICRO).toString().padStart(COST_QUANTITY_SCALE, "0").replace(/0+$/, "")
  return frac ? `${int}.${frac}` : `${int}`
}

/** Integer minor units from a string. Throws when not an integer in range. */
export const parseValueMinor = (value: string): bigint => {
  if (!COST_VALUE_MINOR_REGEX.test(value)) throw new Error(Err.COST_INVALID)
  const v = BigInt(value)
  if (v > COST_MAX_VALUE_MINOR) throw new Error(Err.COST_INVALID)
  return v
}

/** Round half up division for non negative BigInt. */
const divRoundHalfUp = (num: bigint, den: bigint): bigint => (2n * num + den) / (2n * den)

/**
 * Value of a receipt line: round half up (qty x unit cost), in minor units (R18).
 * unitCostMinor is a decimal string in minor units per base unit, up to 10 decimals.
 */
export const receiptValueMinor = (qty: string, unitCostMinor: string): bigint => {
  if (!COST_DECIMAL_REGEX.test(unitCostMinor)) throw new Error(Err.COST_INVALID)
  const [int = "0", frac = ""] = unitCostMinor.split(".")
  const scale = 10n ** BigInt(frac.length)
  const unitScaled = BigInt(int + frac)
  const value = divRoundHalfUp(toMicro(qty) * unitScaled, MICRO * scale)
  if (value > COST_MAX_VALUE_MINOR) throw new Error(Err.COST_INVALID)
  return value
}

export type PoolState = { qtyMicro: bigint; valueMinor: bigint }

/** The pool invariants of R13 that do not depend on history. */
export const isPoolStateValid = (p: PoolState): boolean =>
  p.qtyMicro >= 0n && p.valueMinor >= 0n && (p.qtyMicro > 0n || p.valueMinor === 0n)

/**
 * Value of issuing qtyMicro from a pool (R12). The last unit takes the remainder:
 * issuing the whole pool returns the whole pool value, so nothing is left over.
 * Returns null when qtyMicro is above the pool quantity or not positive (the caller fails
 * with COST_NEGATIVE_STOCK_NOT_SUPPORTED or COST_UNDETERMINED).
 */
export const issueValueMinor = (pool: PoolState, qtyMicro: bigint): bigint | null => {
  if (qtyMicro <= 0n || qtyMicro > pool.qtyMicro) return null
  if (qtyMicro === pool.qtyMicro) return pool.valueMinor
  return divRoundHalfUp(pool.valueMinor * qtyMicro, pool.qtyMicro)
}

export const applyReceipt = (pool: PoolState, qtyMicro: bigint, valueMinor: bigint): PoolState => {
  if (qtyMicro <= 0n || valueMinor < 0n) throw new Error(Err.COST_INVALID)
  const next = { qtyMicro: pool.qtyMicro + qtyMicro, valueMinor: pool.valueMinor + valueMinor }
  if (next.valueMinor > COST_MAX_VALUE_MINOR) throw new Error(Err.COST_INVALID)
  return next
}

export const applyIssue = (
  pool: PoolState,
  qtyMicro: bigint
): { pool: PoolState; valueMinor: bigint } | null => {
  const valueMinor = issueValueMinor(pool, qtyMicro)
  if (valueMinor === null) return null
  return {
    valueMinor,
    pool: { qtyMicro: pool.qtyMicro - qtyMicro, valueMinor: pool.valueMinor - valueMinor },
  }
}

/** Display average: value / qty rounded half up to 10 decimals, as a string. "0" for an empty pool. */
export const averageUnitCost = (pool: PoolState): string => {
  if (pool.qtyMicro === 0n) return "0"
  const scale = 10n ** BigInt(COST_UNIT_COST_SCALE)
  const scaled = divRoundHalfUp(pool.valueMinor * MICRO * scale, pool.qtyMicro)
  const int = scaled / scale
  const frac = (scaled % scale).toString().padStart(COST_UNIT_COST_SCALE, "0").replace(/0+$/, "")
  return frac ? `${int}.${frac}` : `${int}`
}

/**
 * Proportional share for inherited cost (R31). Uses the cumulative target
 * round half up (total x (already + q) / totalQty) minus what was already inherited, so the
 * last part lands exactly on the source total and no part can go below zero.
 * Returns null when the parts would exceed the source quantity (COST_SOURCE_EXCEEDED).
 */
export const inheritedShareMinor = (args: {
  totalQtyMicro: bigint
  totalValueMinor: bigint
  alreadyQtyMicro: bigint
  alreadyValueMinor: bigint
  qtyMicro: bigint
}): bigint | null => {
  const { totalQtyMicro, totalValueMinor, alreadyQtyMicro, alreadyValueMinor, qtyMicro } = args
  if (qtyMicro <= 0n || totalQtyMicro <= 0n || alreadyQtyMicro + qtyMicro > totalQtyMicro) return null
  const target = divRoundHalfUp(totalValueMinor * (alreadyQtyMicro + qtyMicro), totalQtyMicro)
  const share = target - alreadyValueMinor
  return share < 0n ? null : share
}
