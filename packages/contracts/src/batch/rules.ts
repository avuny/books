import type { WarehouseLocationPostingIntent } from "../warehouse-location/constants.js"
import {
  BATCH_DATE_REGEX,
  BATCH_NUMBER_MAX_LENGTH,
  SHELF_LIFE_UNITS,
  type BatchStatus,
  type ShelfLifeUnit,
} from "./constants.js"
import { BatchErrorCode as Err } from "./errors.js"

/** What the caller tells us about a batch. null and undefined both mean "not given". */
export type BatchSpec = {
  number: string
  manufacturedOn?: string | null
  expiresOn?: string | null
  notes?: string | null
  shelfLifeValue?: number | null
  shelfLifeUnit?: ShelfLifeUnit | null
}

export const normalizeBatchNumber = (n: string): string => n.trim()

/** Identity of a batch number inside an item: trimmed and case-insensitive (matches the unique index). */
export const batchNumberKey = (n: string): string => normalizeBatchNumber(n).toLowerCase()

/** A real calendar day in YYYY-MM-DD form (rejects 2026-02-30, which a lenient parser would roll over). */
export const isRealDate = (d: string): boolean => {
  const t = Date.parse(`${d}T00:00:00Z`)
  return BATCH_DATE_REGEX.test(d) && !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d
}

/**
 * Calculates an expiration date from a manufacturing date and shelf life using real calendar arithmetic.
 * MONTH and YEAR clamp to the last day of the target month (e.g. 2024-01-31 + 1 month = 2024-02-29).
 */
export function addShelfLifeToDate(
  dateStr: string,
  value: number,
  unit: ShelfLifeUnit
): string {
  const parts = dateStr.split("-")
  let year = parseInt(parts[0] ?? "", 10)
  let month = parseInt(parts[1] ?? "", 10) // 1-12
  let day = parseInt(parts[2] ?? "", 10) // 1-31

  if (unit === "DAY") {
    const d = new Date(Date.UTC(year, month - 1, day))
    d.setUTCDate(d.getUTCDate() + value)
    return d.toISOString().slice(0, 10)
  }

  if (unit === "MONTH") {
    const totalMonths = month - 1 + value
    year += Math.floor(totalMonths / 12)
    month = ((totalMonths % 12) + 12) % 12 + 1
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    day = Math.min(day, daysInMonth)
    const yStr = String(year).padStart(4, "0")
    const mStr = String(month).padStart(2, "0")
    const dStr = String(day).padStart(2, "0")
    return `${yStr}-${mStr}-${dStr}`
  }

  if (unit === "YEAR") {
    year += value
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    day = Math.min(day, daysInMonth)
    const yStr = String(year).padStart(4, "0")
    const mStr = String(month).padStart(2, "0")
    const dStr = String(day).padStart(2, "0")
    return `${yStr}-${mStr}-${dStr}`
  }

  throw new Error(`Unknown shelf life unit: ${unit}`)
}

/**
 * Resolves shelf life and expiration date for batch creation using the business precedence rules:
 * Shelf life:
 *  1. Explicit shelf life on batch input
 *  2. Item default shelf life
 *  3. None
 * Expiry date:
 *  1. Explicit expiresOn
 *  2. Calculated from manufacturedOn + resolved shelf life
 *  3. Null
 */
export function resolveBatchShelfLifeAndExpiry(args: {
  spec: {
    manufacturedOn?: string | null
    expiresOn?: string | null
    shelfLifeValue?: number | null
    shelfLifeUnit?: ShelfLifeUnit | null
  }
  defaultShelfLife?: {
    value: number | null
    unit: ShelfLifeUnit | null
  } | null
}): {
  shelfLifeValue: number | null
  shelfLifeUnit: ShelfLifeUnit | null
  expiresOn: string | null
} {
  const { spec, defaultShelfLife } = args

  let resolvedShelfLife: { value: number; unit: ShelfLifeUnit } | null = null
  if (spec.shelfLifeValue != null && spec.shelfLifeUnit != null) {
    resolvedShelfLife = { value: spec.shelfLifeValue, unit: spec.shelfLifeUnit }
  } else if (defaultShelfLife?.value != null && defaultShelfLife?.unit != null) {
    resolvedShelfLife = { value: defaultShelfLife.value, unit: defaultShelfLife.unit }
  }

  let resolvedExpiresOn: string | null = null
  if (spec.expiresOn != null && spec.expiresOn.trim() !== "") {
    resolvedExpiresOn = spec.expiresOn
  } else if (spec.manufacturedOn != null && spec.manufacturedOn.trim() !== "" && resolvedShelfLife != null) {
    resolvedExpiresOn = addShelfLifeToDate(
      spec.manufacturedOn,
      resolvedShelfLife.value,
      resolvedShelfLife.unit
    )
  }

  return {
    shelfLifeValue: resolvedShelfLife?.value ?? null,
    shelfLifeUnit: resolvedShelfLife?.unit ?? null,
    expiresOn: resolvedExpiresOn,
  }
}

/** The first problem with one batch spec, or null. */
export function checkBatchSpec(spec: BatchSpec): Err | null {
  const number = normalizeBatchNumber(spec.number)
  if (number.length === 0 || number.length > BATCH_NUMBER_MAX_LENGTH) return Err.BATCH_NUMBER_INVALID
  const { manufacturedOn, expiresOn, shelfLifeValue, shelfLifeUnit } = spec
  for (const date of [manufacturedOn, expiresOn]) {
    if (date != null && !isRealDate(date)) return Err.BATCH_DATES_INVALID
  }
  // ISO dates compare correctly as text.
  if (manufacturedOn != null && expiresOn != null && expiresOn < manufacturedOn) return Err.BATCH_DATES_INVALID

  if (
    (shelfLifeValue != null && shelfLifeUnit == null) ||
    (shelfLifeValue == null && shelfLifeUnit != null) ||
    (shelfLifeValue != null && (!Number.isInteger(shelfLifeValue) || shelfLifeValue <= 0)) ||
    (shelfLifeUnit != null && !SHELF_LIFE_UNITS.includes(shelfLifeUnit))
  ) {
    return Err.BATCH_SHELF_LIFE_INVALID
  }

  return null
}

/**
 * Collapses specs that name the same batch (same number, any letter case) into one.
 * Two specs may differ only by leaving a detail out; contradicting details are a conflict.
 * First occurrence order is kept.
 */
export function mergeBatchSpecs(
  specs: readonly BatchSpec[]
): { ok: true; value: BatchSpec[] } | { ok: false; error: Err } {
  const merged = new Map<string, BatchSpec>()
  for (const spec of specs) {
    const key = batchNumberKey(spec.number)
    const known = merged.get(key)
    if (!known) {
      merged.set(key, { ...spec, number: normalizeBatchNumber(spec.number) })
      continue
    }
    for (const field of ["manufacturedOn", "expiresOn", "notes", "shelfLifeValue", "shelfLifeUnit"] as const) {
      const a = known[field] ?? null
      const b = spec[field] ?? null
      if (a !== null && b !== null && a !== b) return { ok: false, error: Err.BATCH_DETAILS_CONFLICT }
      if (a === null && b !== null) (known as any)[field] = b
    }
  }
  return { ok: true, value: [...merged.values()] }
}

/**
 * May stock of a batch in this status take part in a posting with this intent?
 * Receipts need available or quarantined, issues need available; moves and adjustments always work.
 */
export function batchAllowsIntent(status: BatchStatus, intent: WarehouseLocationPostingIntent): boolean {
  if (intent === "issue") return status === "available"
  if (intent === "receive") return status === "available" || status === "quarantined"
  return true
}
