import {
  UNIT_BASE_CONVERSION_FACTOR,
  UNIT_COLLECTION_MAX_UNITS,
  UNIT_CONVERSION_FACTOR_PATTERN,
  UnitCollectionErrorCode,
  type UnitCollectionErrorCode as Code,
  type UnitType,
} from "@avuny/contracts"
import { pass, reject, violation, type RuleResult, type RuleViolation } from "../shared/rules.js"

const Err = UnitCollectionErrorCode

export interface UnitRef {
  id: string
  name: string
  symbol: string
  type: UnitType
  isActive: boolean
}
export interface ExtraUnitInput {
  unitId: string
  conversionFactor: string
}
export interface CollectionUnitRow {
  unitId: string
  conversionFactor: string
}
export interface CollectionDiff {
  add: CollectionUnitRow[]
  update: CollectionUnitRow[]
  remove: string[]
}

/** "0.010000000000" -> "0.01", "007" -> "7": makes numeric strings comparable. */
export function normalizeDecimal(value: string): string {
  const [rawInt = "", rawFrac = ""] = value.trim().split(".")
  const int = rawInt.replace(/^0+(?=\d)/, "") || "0"
  const frac = rawFrac.replace(/0+$/, "")
  return frac ? `${int}.${frac}` : int
}

/** Fits numeric(24, 12) and is strictly greater than zero. */
export function isValidFactor(value: string): boolean {
  return UNIT_CONVERSION_FACTOR_PATTERN.test(value) && /[1-9]/.test(value)
}

/**
 * A collection = its base unit + extra units, all of the SAME type as the base unit,
 * each unit at most once (the base unit counts), every factor > 0, at most `maxUnits`
 * rows in total. Returns the base unit when the draft is valid.
 */
export function checkCollectionDraft(
  baseUnitId: string,
  extras: readonly ExtraUnitInput[],
  found: readonly UnitRef[],
  maxUnits: number = UNIT_COLLECTION_MAX_UNITS
): RuleResult<UnitRef, Code> {
  const byId = new Map(found.map((u) => [u.id, u]))
  const base = byId.get(baseUnitId)
  if (!base || !base.isActive) return reject(Err.UNIT_NOT_FOUND, "Base unit not found")
  if (extras.length + 1 > maxUnits)
    return reject(
      Err.UNIT_COLLECTION_TOO_MANY_UNITS,
      `A collection can hold at most ${maxUnits} units`
    )

  const seen = new Set<string>([baseUnitId])
  for (const extra of extras) {
    if (seen.has(extra.unitId))
      return reject(
        Err.UNIT_DUPLICATE_IN_COLLECTION,
        "A unit can appear only once in a collection (the base unit is included automatically)"
      )
    seen.add(extra.unitId)

    const unit = byId.get(extra.unitId)
    if (!unit || !unit.isActive) return reject(Err.UNIT_NOT_FOUND, "Unit not found")
    if (unit.type !== base.type)
      return reject(
        Err.UNIT_TYPE_MISMATCH,
        `"${unit.symbol}" is a ${unit.type} unit but the base unit is a ${base.type} unit`
      )
    if (!isValidFactor(extra.conversionFactor))
      return reject(
        Err.UNIT_INVALID_CONVERSION_FACTOR,
        `Invalid conversion factor for "${unit.symbol}"`
      )
  }
  return pass(base)
}

/** Rows to store: the base unit at factor 1 first, then the extras (normalized). */
export function buildCollectionRows(
  baseUnitId: string,
  extras: readonly ExtraUnitInput[]
): CollectionUnitRow[] {
  return [
    { unitId: baseUnitId, conversionFactor: UNIT_BASE_CONVERSION_FACTOR },
    ...extras.map((e) => ({
      unitId: e.unitId,
      conversionFactor: normalizeDecimal(e.conversionFactor),
    })),
  ]
}

/**
 * What to write so the stored extras become exactly `desired`.
 * The base unit row is never touched. Factors are compared as normalized decimals, so a
 * stored "0.010000000000" equals a submitted "0.01" and causes no write.
 */
export function diffCollectionUnits(
  current: readonly CollectionUnitRow[],
  desired: readonly ExtraUnitInput[],
  baseUnitId: string
): CollectionDiff {
  const have = new Map(
    current
      .filter((r) => r.unitId !== baseUnitId)
      .map((r) => [r.unitId, normalizeDecimal(r.conversionFactor)] as const)
  )
  const want = new Map(desired.map((d) => [d.unitId, normalizeDecimal(d.conversionFactor)] as const))
  return {
    add: [...want]
      .filter(([unitId]) => !have.has(unitId))
      .map(([unitId, conversionFactor]) => ({ unitId, conversionFactor })),
    update: [...want]
      .filter(([unitId, factor]) => have.has(unitId) && have.get(unitId) !== factor)
      .map(([unitId, conversionFactor]) => ({ unitId, conversionFactor })),
    remove: [...have.keys()].filter((unitId) => !want.has(unitId)),
  }
}

export const diffHasChanges = (d: CollectionDiff): boolean =>
  d.add.length > 0 || d.update.length > 0 || d.remove.length > 0

/** Collection names are not unique, so a generated one is always acceptable. */
export function collectionName(
  input: string | undefined,
  base: Pick<UnitRef, "name" | "symbol">
): string {
  const name = input?.trim()
  return name ? name : `${base.name} (${base.symbol})`
}

/** A collection that items point at must stay (the composite FK would refuse anyway). */
export function checkCollectionDeletable(itemCount: number): RuleViolation<Code> | null {
  return itemCount > 0
    ? violation(Err.UNIT_COLLECTION_IN_USE, "This unit collection is used by items")
    : null
}

export const unitCollectionRules = {
  normalizeDecimal,
  isValidFactor,
  checkCollectionDraft,
  buildCollectionRows,
  diffCollectionUnits,
  diffHasChanges,
  collectionName,
  checkCollectionDeletable,
} as const

export type UnitCollectionRules = typeof unitCollectionRules

