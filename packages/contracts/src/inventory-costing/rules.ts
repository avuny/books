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

/* ---------- cost determination (SPEC R1 to R5, R8) ---------- */

export type DeterminedCost = {
  valueMinor: bigint
  source: "DOCUMENT" | "USER" | "INHERITED" | "CONFIRMED_PROPOSAL"
  isZeroCost: boolean
  zeroCostReason: string | null
  /** Set for CONFIRMED_PROPOSAL: the value the system proposed, stored next to the final value. */
  proposedValueMinor: bigint | null
}

export type CostDetermination =
  | { ok: true; cost: DeterminedCost }
  | { ok: false; error: InventoryCostingErrorCodeValue }

type InventoryCostingErrorCodeValue = (typeof Err)[keyof typeof Err]

/**
 * Turns the cost input of one value-in line into an exact value, or says why it cannot.
 * There is no default: undefined input fails with STOCK_MOVEMENT_COST_REQUIRED (R1). A zero value
 * is accepted only with a stated reason (R3). The item default cost price is never an input (R5).
 * INHERITED input is resolved by the engine from its source (a layer, an entry or a movement), so
 * the caller passes `inheritedValueMinor` here after that lookup.
 */
export const determineCost = (
  input:
    | {
        source: "DOCUMENT"
        totalValueMinor: string
        zeroCost?: { reason: string } | undefined
      }
    | { source: "USER"; unitCost: string; zeroCost?: { reason: string } | undefined }
    | { source: "CONFIRMED_PROPOSAL"; unitCost: string; proposedUnitCost: string }
    | { source: "INHERITED"; additionalValueMinor?: string | undefined }
    | undefined,
  qty: string,
  inheritedValueMinor?: bigint
): CostDetermination => {
  if (!input) return { ok: false, error: Err.STOCK_MOVEMENT_COST_REQUIRED }
  try {
    let valueMinor: bigint
    let proposed: bigint | null = null
    let zeroReason: string | null = null
    switch (input.source) {
      case "DOCUMENT":
        valueMinor = parseValueMinor(input.totalValueMinor)
        zeroReason = input.zeroCost?.reason ?? null
        break
      case "USER":
        valueMinor = receiptValueMinor(qty, input.unitCost)
        zeroReason = input.zeroCost?.reason ?? null
        break
      case "CONFIRMED_PROPOSAL":
        valueMinor = receiptValueMinor(qty, input.unitCost)
        proposed = receiptValueMinor(qty, input.proposedUnitCost)
        break
      case "INHERITED": {
        if (inheritedValueMinor === undefined || inheritedValueMinor < 0n) {
          return { ok: false, error: Err.COST_SOURCE_NOT_FOUND }
        }
        const extra = input.additionalValueMinor ? parseValueMinor(input.additionalValueMinor) : 0n
        valueMinor = inheritedValueMinor + extra
        if (valueMinor > COST_MAX_VALUE_MINOR) return { ok: false, error: Err.COST_INVALID }
        break
      }
    }
    const isZero = valueMinor === 0n
    // A zero needs a stated reason, except inherited zero (the source stated it) (R3).
    if (isZero && input.source !== "INHERITED" && !zeroReason) {
      return { ok: false, error: Err.COST_ZERO_REASON_REQUIRED }
    }
    // A reason on a non zero value is a contradiction: reject instead of ignoring it.
    if (!isZero && zeroReason) return { ok: false, error: Err.COST_INVALID }
    return {
      ok: true,
      cost: {
        valueMinor,
        source: input.source,
        isZeroCost: isZero,
        zeroCostReason: zeroReason,
        proposedValueMinor: proposed,
      },
    }
  } catch {
    return { ok: false, error: Err.COST_INVALID }
  }
}

/* ---------- FIFO strategy math ---------- */

export type FifoLayerState = { id: string; remainingQtyMicro: bigint; remainingValueMinor: bigint }
export type FifoSlice = { layerId: string; qtyMicro: bigint; valueMinor: bigint }

/**
 * Takes qtyMicro from layers in the order given (oldest first). Taking a whole layer takes its
 * whole remaining value (no dust is left). A partial take is round half up of
 * value x take / remaining. Returns null when the layers cover less than the quantity: the caller
 * fails with COST_UNDETERMINED (R6). A partial take never takes more value than the layer holds.
 */
export const allocateFifo = (
  layers: readonly FifoLayerState[],
  qtyMicro: bigint
): { slices: FifoSlice[]; totalValueMinor: bigint } | null => {
  if (qtyMicro <= 0n) return null
  let left = qtyMicro
  let total = 0n
  const slices: FifoSlice[] = []
  for (const layer of layers) {
    if (left === 0n) break
    if (layer.remainingQtyMicro <= 0n) continue
    const take = layer.remainingQtyMicro < left ? layer.remainingQtyMicro : left
    const value =
      take === layer.remainingQtyMicro
        ? layer.remainingValueMinor
        : divRoundHalfUp(layer.remainingValueMinor * take, layer.remainingQtyMicro)
    slices.push({ layerId: layer.id, qtyMicro: take, valueMinor: value })
    total += value
    left -= take
  }
  return left > 0n ? null : { slices, totalValueMinor: total }
}
