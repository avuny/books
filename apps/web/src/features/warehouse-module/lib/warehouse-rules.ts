import type { WarehouseListItemDto } from "../types"

/** What the signed-in user may do with warehouses; used ONLY to show/hide UI. */
export type WarehouseAbilities = {
  canCreate: boolean
  canUpdate: boolean
  canDeactivate: boolean
  canDelete: boolean
}

type WarehouseFacts = Pick<WarehouseListItemDto, "type" | "isDefault" | "isSystem" | "isActive">

export type WarehouseActionAvailability = {
  canEdit: boolean
  canSetDefault: boolean
  canDeactivate: boolean
  canReactivate: boolean
  canDelete: boolean
  /** Shown but disabled: the server refuses to retire or delete the default warehouse. */
  deactivateDisabled: boolean
  deleteDisabled: boolean
}

/**
 * Which warehouse actions to offer. System warehouses are read-only (nothing is offered);
 * rules the server enforces (default can't be retired or deleted) disable instead of hiding.
 */
export function getWarehouseActionAvailability(
  warehouse: WarehouseFacts,
  abilities: WarehouseAbilities
): WarehouseActionAvailability {
  const editable = !warehouse.isSystem
  return {
    canEdit: editable && abilities.canUpdate,
    canSetDefault:
      editable && abilities.canUpdate && warehouse.isActive && warehouse.type === "physical" && !warehouse.isDefault,
    canDeactivate: editable && abilities.canDeactivate && warehouse.isActive,
    canReactivate: editable && abilities.canDeactivate && !warehouse.isActive,
    canDelete: editable && abilities.canDelete,
    deactivateDisabled: warehouse.isDefault,
    deleteDisabled: warehouse.isDefault,
  }
}

/** "Street, City, Region, Postal, CC" without the empty parts; empty string when there is none. */
export function formatAddress(parts: {
  addressLine: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  countryCode: string | null
}): string {
  return [parts.addressLine, parts.city, parts.region, parts.postalCode, parts.countryCode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ")
}
