import type {
  BulkCreateWarehouseLocationsInput,
  BulkCreateWarehouseLocationsResult,
  ChangeWarehouseLocationBarcodeInput,
  BlockWarehouseLocationInput,
  CreateWarehouseLocationInput,
  MoveWarehouseLocationInput,
  UpdateWarehouseLocationInput,
  WarehouseLocationDetailDto,
  WarehouseLocationDto,
  WarehouseLocationListItemDto,
  WarehouseLocationPurpose,
  WarehouseLocationTreeResponse,
  WarehouseLocationType,
  WarehouseType,
} from "@avuny/contracts"

export type {
  BulkCreateWarehouseLocationsInput,
  BulkCreateWarehouseLocationsResult,
  ChangeWarehouseLocationBarcodeInput,
  BlockWarehouseLocationInput,
  CreateWarehouseLocationInput,
  MoveWarehouseLocationInput,
  UpdateWarehouseLocationInput,
  WarehouseLocationDetailDto,
  WarehouseLocationDto,
  WarehouseLocationListItemDto,
  WarehouseLocationPurpose,
  WarehouseLocationType,
  WarehouseType,
}

export type WarehouseLocationTreeNode = WarehouseLocationTreeResponse["items"][number]

// UI-only types live here, never in the contracts.
export type LocationScope = "all" | "stockable" | "blocked" | "inactive"
export type LocationView = "table" | "tree"

/** The warehouse facts location screens need. */
export type LocationWarehouse = {
  id: string
  code: string
  name: string
  type: WarehouseType
  isActive: boolean
  isSystem: boolean
}

/** A fixed parent for "add child" flows. */
export type LocationParentRef = { id: string; name: string; type: WarehouseLocationType }
