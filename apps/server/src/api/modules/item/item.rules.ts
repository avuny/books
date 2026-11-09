import {
  ItemErrorCode,
  type InventoryValuationMethod,
  type ItemErrorCode as Code,
} from "@avuny/contracts"
import { pass, reject, violation, type RuleResult, type RuleViolation } from "../shared/rules.js"

/**
 * PURE business rules of items: no database, no injected services. The service loads the
 * rows, asks these functions, and orchestrates the writes.
 */

const Err = ItemErrorCode

export interface TrackingFlags {
  isInventoryTracked: boolean
  isBatchTracked: boolean
}
export interface ItemTrackingSnapshot extends TrackingFlags {
  inventoryValuationMethod: InventoryValuationMethod
}
export type UnitSource =
  | { kind: "base"; baseUnitId: string }
  | { kind: "collection"; collectionId: string }

/** Fields that stored quantities and costs depend on: frozen once stock has moved. */
export type LockedField = "unit" | "isInventoryTracked" | "isBatchTracked" | "inventoryValuationMethod"

/** Batch tracking only makes sense for items whose inventory is tracked (ck_item_batch_requires_tracking). */
export function checkTracking(flags: TrackingFlags): RuleViolation<Code> | null {
  return flags.isBatchTracked && !flags.isInventoryTracked
    ? violation(Err.ITEM_BATCH_REQUIRES_TRACKING, "Batch tracking requires inventory tracking")
    : null
}

/** The tracking flags the item will have after `patch` is applied. */
export function effectiveTracking(
  current: TrackingFlags,
  patch: Partial<TrackingFlags>
): TrackingFlags {
  return {
    isInventoryTracked: patch.isInventoryTracked ?? current.isInventoryTracked,
    isBatchTracked: patch.isBatchTracked ?? current.isBatchTracked,
  }
}

/** Create: exactly one of base unit / collection. (The schema enforces it; this is the safety net.) */
export function selectUnitSource(input: {
  baseUnitId?: string
  unitCollectionId?: string
}): UnitSource | null {
  if (input.unitCollectionId && !input.baseUnitId)
    return { kind: "collection", collectionId: input.unitCollectionId }
  if (input.baseUnitId && !input.unitCollectionId)
    return { kind: "base", baseUnitId: input.baseUnitId }
  return null
}

/** Update: the unit source, or null when the request does not actually change the unit. */
export function pickUnitChange(
  current: { baseUnitId: string; unitCollectionId: string },
  input: { baseUnitId?: string; unitCollectionId?: string }
): UnitSource | null {
  if (input.unitCollectionId !== undefined)
    return input.unitCollectionId === current.unitCollectionId
      ? null
      : { kind: "collection", collectionId: input.unitCollectionId }
  if (input.baseUnitId !== undefined)
    return input.baseUnitId === current.baseUnitId
      ? null
      : { kind: "base", baseUnitId: input.baseUnitId }
  return null
}

/** An item needs an existing, active category of its own organization. */
export function requireCategory<T extends { isActive: boolean }>(
  category: T | null | undefined
): RuleResult<T, Code> {
  return category && category.isActive
    ? pass(category)
    : reject(Err.ITEM_CATEGORY_INVALID, "Choose an active category from this organization")
}

/** The base unit must exist in the global catalog and be active. */
export function requireBaseUnit<T extends { isActive: boolean }>(
  unit: T | null | undefined
): RuleResult<T, Code> {
  return unit && unit.isActive
    ? pass(unit)
    : reject(Err.ITEM_UNIT_INVALID, "Choose an active base unit")
}

/** Name of the collection created automatically for an item: "Meter (m)". */
export function autoCollectionName(unit: { name: string; symbol: string }): string {
  return `${unit.name} (${unit.symbol})`
}

/** Which locked fields would this change touch? */
export function changedLockedFields(
  current: ItemTrackingSnapshot,
  patch: Partial<ItemTrackingSnapshot>,
  unitChanged: boolean
): LockedField[] {
  const changed: LockedField[] = []
  if (unitChanged) changed.push("unit")
  if (patch.isInventoryTracked !== undefined && patch.isInventoryTracked !== current.isInventoryTracked)
    changed.push("isInventoryTracked")
  if (patch.isBatchTracked !== undefined && patch.isBatchTracked !== current.isBatchTracked)
    changed.push("isBatchTracked")
  if (
    patch.inventoryValuationMethod !== undefined &&
    patch.inventoryValuationMethod !== current.inventoryValuationMethod
  )
    changed.push("inventoryValuationMethod")
  return changed
}

export function checkLock(
  changed: readonly LockedField[],
  hasMovements: boolean
): RuleViolation<Code> | null {
  return changed.length > 0 && hasMovements
    ? violation(
        Err.ITEM_LOCKED_FIELD,
        `These settings cannot change after the item has stock movements: ${changed.join(", ")}`
      )
    : null
}

/** Items with history are deactivated, never deleted. */
export function checkDeletable(hasMovements: boolean): RuleViolation<Code> | null {
  return hasMovements
    ? violation(
        Err.ITEM_HAS_HISTORY,
        "This item has stock history. Deactivate it instead of deleting it"
      )
    : null
}

export const itemRules = {
  checkTracking,
  effectiveTracking,
  selectUnitSource,
  pickUnitChange,
  requireCategory,
  requireBaseUnit,
  autoCollectionName,
  changedLockedFields,
  checkLock,
  checkDeletable,
} as const

export type ItemRules = typeof itemRules
