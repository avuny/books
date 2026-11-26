import type { WarehouseType } from "../warehouse/constants.js"
import {
  WAREHOUSE_LOCATION_BULK_MAX_NODES,
  WAREHOUSE_LOCATION_CODE_SEPARATOR,
  WAREHOUSE_LOCATION_DEFAULT_STOCKABLE_TYPES,
  WAREHOUSE_LOCATION_PURPOSE_FLAGS,
  WAREHOUSE_LOCATION_STOCKABLE_TYPES,
  WAREHOUSE_LOCATION_TYPE_RANK,
  WAREHOUSE_LOCATION_VIRTUAL_WAREHOUSE_TYPES,
  type WarehouseLocationPurpose,
  type WarehouseLocationType,
} from "./constants.js"
import { WarehouseLocationErrorCode } from "./errors.js"

/** Pure location rules shared by the API (authoritative) and the web (early feedback). */

export interface LocationFlags {
  isStockable: boolean
  isPickable: boolean
  isReceivable: boolean
}

type FlagError =
  | typeof WarehouseLocationErrorCode.WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE
  | typeof WarehouseLocationErrorCode.WAREHOUSE_LOCATION_FLAGS_INVALID

export function isStockableType(type: WarehouseLocationType): boolean {
  return (WAREHOUSE_LOCATION_STOCKABLE_TYPES as readonly string[]).includes(type)
}

/** A child's rank must be strictly greater than its parent's. A root (null parent) is always fine. */
export function isPlacementAllowed(
  parentType: WarehouseLocationType | null,
  childType: WarehouseLocationType
): boolean {
  if (parentType === null) return true
  return WAREHOUSE_LOCATION_TYPE_RANK[childType] > WAREHOUSE_LOCATION_TYPE_RANK[parentType]
}

/** virtual_bin only exists in virtual warehouses, which in turn hold only virtual_bin and area. */
export function isTypeAllowedInWarehouse(
  warehouseType: WarehouseType,
  type: WarehouseLocationType
): boolean {
  if (warehouseType === "virtual") {
    return (WAREHOUSE_LOCATION_VIRTUAL_WAREHOUSE_TYPES as readonly string[]).includes(type)
  }
  return type !== "virtual_bin"
}

/** Flags a location gets when the caller states nothing. */
export function defaultFlags(
  type: WarehouseLocationType,
  purpose: WarehouseLocationPurpose
): LocationFlags {
  const isStockable = (WAREHOUSE_LOCATION_DEFAULT_STOCKABLE_TYPES as readonly string[]).includes(type)
  const fromPurpose = WAREHOUSE_LOCATION_PURPOSE_FLAGS[purpose]
  return {
    isStockable,
    isPickable: isStockable && fromPurpose.isPickable,
    isReceivable: isStockable && fromPurpose.isReceivable,
  }
}

/** Checks a final flag combination against the type. Returns an error code or null. */
export function validateFlags(type: WarehouseLocationType, flags: LocationFlags): FlagError | null {
  if (flags.isStockable && !isStockableType(type)) {
    return WarehouseLocationErrorCode.WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE
  }
  if ((flags.isPickable || flags.isReceivable) && !flags.isStockable) {
    return WarehouseLocationErrorCode.WAREHOUSE_LOCATION_FLAGS_INVALID
  }
  return null
}

/** Defaults first, explicit values on top, then validation. */
export function resolveFlags(input: {
  type: WarehouseLocationType
  purpose: WarehouseLocationPurpose
  isStockable?: boolean
  isPickable?: boolean
  isReceivable?: boolean
}): { ok: true; flags: LocationFlags } | { ok: false; error: FlagError } {
  const base = defaultFlags(input.type, input.purpose)
  const isStockable = input.isStockable ?? base.isStockable
  const purposeFlags = WAREHOUSE_LOCATION_PURPOSE_FLAGS[input.purpose]
  const flags: LocationFlags = {
    isStockable,
    isPickable: input.isPickable ?? (isStockable && purposeFlags.isPickable),
    isReceivable: input.isReceivable ?? (isStockable && purposeFlags.isReceivable),
  }
  const error = validateFlags(input.type, flags)
  return error ? { ok: false, error } : { ok: true, flags }
}

export function buildFullCode(parentFullCode: string | null, code: string): string {
  return parentFullCode ? `${parentFullCode}${WAREHOUSE_LOCATION_CODE_SEPARATOR}${code}` : code
}

export function formatGeneratedCode(prefix: string, n: number, pad: number): string {
  return `${prefix}${String(n).padStart(pad, "0")}`
}

/** Next free sibling code for a prefix: highest existing numeric suffix + 1, or 1. */
export function suggestNextCode(prefix: string, siblingCodes: readonly string[], pad: number): string {
  const p = prefix.toUpperCase()
  let max = 0
  for (const code of siblingCodes) {
    const upper = code.toUpperCase()
    if (!upper.startsWith(p)) continue
    const rest = upper.slice(p.length)
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest))
  }
  return formatGeneratedCode(p, max + 1, pad)
}

/* ---------- bulk generation ---------- */

export interface BulkLevel {
  type: WarehouseLocationType
  prefix: string
  start: number
  count: number
  pad: number
}

export interface BulkPlannedNode {
  /** Position in the plan; parents always come before their children. */
  index: number
  /** null means the node hangs directly under the request's parent (or is a root). */
  parentIndex: number | null
  level: number
  type: WarehouseLocationType
  code: string
}

/** Total nodes the levels would create, or Infinity when it exceeds the bulk cap. */
export function countBulkNodes(levels: readonly BulkLevel[]): number {
  let running = 1
  let total = 0
  for (const level of levels) {
    running *= level.count
    total += running
    if (total > WAREHOUSE_LOCATION_BULK_MAX_NODES) return Infinity
  }
  return total
}

/** Ranks must strictly increase from the parent through every level. */
export function validateBulkLevels(
  parentType: WarehouseLocationType | null,
  levels: readonly BulkLevel[]
): boolean {
  let previous = parentType
  for (const level of levels) {
    if (!isPlacementAllowed(previous, level.type)) return false
    previous = level.type
  }
  return true
}

/** Expands levels into a cross-product tree. Numbering restarts under every parent. */
export function planBulkCreate(levels: readonly BulkLevel[]): BulkPlannedNode[] {
  const nodes: BulkPlannedNode[] = []
  let previousLevel: number[] = []
  levels.forEach((level, levelIndex) => {
    const parents: (number | null)[] = levelIndex === 0 ? [null] : previousLevel
    const current: number[] = []
    for (const parentIndex of parents) {
      for (let i = 0; i < level.count; i++) {
        const index = nodes.length
        nodes.push({
          index,
          parentIndex,
          level: levelIndex,
          type: level.type,
          code: formatGeneratedCode(level.prefix, level.start + i, level.pad),
        })
        current.push(index)
      }
    }
    previousLevel = current
  })
  return nodes
}
