import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseDto,
  WarehouseListItemDto,
  WarehouseType,
} from "@avuny/contracts"

export type { CreateWarehouseInput, UpdateWarehouseInput, WarehouseDto, WarehouseListItemDto, WarehouseType }

// UI-only types live here, never in the contracts.
export type WarehouseScope = "all" | "active" | "inactive"
