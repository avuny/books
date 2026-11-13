import {
  WAREHOUSE_LOCATION_TYPES,
  WAREHOUSE_LOCATION_TYPE_RANK,
  isPlacementAllowed,
  isTypeAllowedInWarehouse,
} from "@avuny/contracts"

import type { LocationWarehouse, WarehouseLocationType } from "../types"

/** What the signed-in user may do with locations; used ONLY to show/hide UI. */
export type LocationAbilities = {
  canCreate: boolean
  canUpdate: boolean
  canDeactivate: boolean
  canDelete: boolean
  canMove: boolean
  canBlock: boolean
  canChangeBarcode: boolean
}

type LocationFacts = { isStockable: boolean; isActive: boolean; isBlocked: boolean }

export type LocationActionAvailability = {
  canEdit: boolean
  canAddChild: boolean
  canMove: boolean
  canBlock: boolean
  canUnblock: boolean
  canChangeBarcode: boolean
  canDeactivate: boolean
  canReactivate: boolean
  canDelete: boolean
}

/** Locations of a system or inactive warehouse cannot be changed: the server refuses every write. */
export function isLocationReadOnly(warehouse: Pick<LocationWarehouse, "isSystem" | "isActive"> | null): boolean {
  return warehouse === null || warehouse.isSystem || !warehouse.isActive
}

/** Which location actions to offer. Read-only warehouses offer nothing. */
export function getLocationActionAvailability(
  location: LocationFacts,
  abilities: LocationAbilities,
  readOnly: boolean
): LocationActionAvailability {
  const writable = !readOnly
  return {
    canEdit: writable && abilities.canUpdate,
    // Only containers take children; a stockable location is a leaf.
    canAddChild: writable && abilities.canCreate && location.isActive && !location.isStockable,
    canMove: writable && abilities.canMove,
    canBlock: writable && abilities.canBlock && !location.isBlocked,
    canUnblock: writable && abilities.canBlock && location.isBlocked,
    canChangeBarcode: writable && abilities.canChangeBarcode,
    canDeactivate: writable && abilities.canDeactivate && location.isActive,
    canReactivate: writable && abilities.canDeactivate && !location.isActive,
    canDelete: writable && abilities.canDelete,
  }
}

/**
 * Types a new location may take under a parent in this kind of warehouse. With no known parent
 * (top level) only the warehouse kind restricts; the server still validates the real parent.
 */
export function getAllowedLocationTypes(
  parentType: WarehouseLocationType | null,
  warehouseType: LocationWarehouse["type"]
): WarehouseLocationType[] {
  return WAREHOUSE_LOCATION_TYPES.filter(
    (type) => isTypeAllowedInWarehouse(warehouseType, type) && isPlacementAllowed(parentType, type)
  )
}

const CODE_PREFIXES: Record<WarehouseLocationType, string> = {
  zone: "ZONE-",
  area: "AREA-",
  dock: "DOCK-",
  aisle: "A-",
  rack: "R-",
  bay: "B-",
  level: "L-",
  shelf: "S-",
  bin: "BIN-",
  virtual_bin: "VB-",
}

/** Prefix used by "Suggest next code" and as the default prefix of generated levels. */
export function suggestedCodePrefix(type: WarehouseLocationType): string {
  return CODE_PREFIXES[type]
}

const TYPICAL_ORDER: readonly WarehouseLocationType[] = ["zone", "aisle", "rack", "bay", "level", "bin"]

/** The next sensible level type for the bulk generator: first typical type ranked below the previous level. */
export function suggestBulkLevelType(
  previous: WarehouseLocationType | null,
  warehouseType: LocationWarehouse["type"]
): WarehouseLocationType {
  if (warehouseType === "virtual") return "virtual_bin"
  const floor = previous ? WAREHOUSE_LOCATION_TYPE_RANK[previous] : 0
  return TYPICAL_ORDER.find((type) => WAREHOUSE_LOCATION_TYPE_RANK[type] > floor) ?? "bin"
}

/** True for an empty prefix or one of the built-in suggestions (i.e. the user has not customized it). */
export function isDefaultCodePrefix(prefix: string): boolean {
  return prefix === "" || Object.values(CODE_PREFIXES).includes(prefix)
}
