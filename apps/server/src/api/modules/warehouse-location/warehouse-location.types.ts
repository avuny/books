import type {
  RoleErrorCode,
  WarehouseLocationErrorCode,
  WarehouseLocationPurpose,
  WarehouseLocationType,
  WarehouseType,
} from "@avuny/contracts"
import type { Tx, WarehouseLocation } from "@avuny/db"
import type { permissionChecker } from "../role/index.js"
import type { ActivityLog } from "../warehouse/warehouse.types.js"
import type { WarehouseUsageRegistry } from "../shared/warehouse-usage.js"
import type { createWarehouseLocationRepository } from "./warehouse-location.repository.js"
import type { createWarehouseLocationService } from "./warehouse-location.service.js"

export type WarehouseLocationRepository = ReturnType<typeof createWarehouseLocationRepository>
export type WarehouseLocationService = ReturnType<typeof createWarehouseLocationService>

export type PermissionChecker = Pick<typeof permissionChecker, "check">

export interface WarehouseLocationServiceDeps {
  repository: WarehouseLocationRepository
  permissions: PermissionChecker
  activityLog: ActivityLog
  usage: WarehouseUsageRegistry
}

export type Code = WarehouseLocationErrorCode | RoleErrorCode

/** The warehouse facts a location operation needs (read-only view of the warehouses table). */
export interface WarehouseSummary {
  id: string
  code: string
  name: string
  type: WarehouseType
  isActive: boolean
  isSystem: boolean
}

export interface LocationRow {
  loc: WarehouseLocation
  /** True when the location or any ancestor is blocked. */
  effectiveIsBlocked: boolean
}

export interface LocationDetailRow extends LocationRow {
  hasChildren: boolean
  warehouse: WarehouseSummary
}

export interface LocationPathItem {
  id: string
  code: string
  name: string
  type: WarehouseLocationType
}

export type LocationWriteResult<T> =
  | { ok: true; row: T }
  | { ok: false; reason: "code_taken" | "barcode_taken" }

export interface LocationListFilters {
  warehouseId?: string
  parentId?: string
  rootOnly?: boolean
  type?: WarehouseLocationType
  purpose?: WarehouseLocationPurpose
  isStockable?: boolean
  isPickable?: boolean
  isReceivable?: boolean
  isActive?: boolean
  isBlocked?: boolean
  usable?: boolean
  search?: string
  page: number
  pageSize: number
}

export interface LocationOptionFilters {
  search?: string
  warehouseId?: string
  purpose?: WarehouseLocationPurpose
  stockableOnly: boolean
  containerOnly: boolean
  pickableOnly: boolean
  receivableOnly: boolean
  usableOnly: boolean
  after: { name: string; id: string } | null
  limit: number
}

export interface LocationTreeFilters {
  warehouseId: string
  parent?: Pick<WarehouseLocation, "id" | "treeDepth">
  depth?: number
  includeInactive: boolean
  limit: number
}

export type LocationPatch = Partial<
  Pick<
    WarehouseLocation,
    | "parentId"
    | "code"
    | "fullCode"
    | "name"
    | "type"
    | "purpose"
    | "barcode"
    | "sortOrder"
    | "isStockable"
    | "isPickable"
    | "isReceivable"
    | "isActive"
    | "isBlocked"
    | "blockedReason"
    | "blockedAt"
    | "maxWeight"
    | "maxVolume"
    | "width"
    | "height"
    | "depth"
  >
>

export type { Tx, WarehouseLocation }
