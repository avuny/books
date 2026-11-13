import type {
  ActivityLogAction,
  CreateWarehouseInput,
  DeleteWarehouseResult,
  OptionListResponse,
  PermissionKey,
  RoleErrorCode,
  UpdateWarehouseInput,
  WarehouseDto,
  WarehouseErrorCode,
  WarehouseOffsetListQuery,
  WarehouseOffsetListResponse,
  WarehouseOptionListQuery,
  WarehouseType,
} from "@avuny/contracts"
import type { Tx, Warehouse } from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { permissionChecker } from "../role/index.js"
import type { createWarehouseRepository } from "./warehouse.repository.js"
import type { createWarehouseService } from "./warehouse.service.js"
import type { WarehouseUsageRegistry } from "../shared/warehouse-usage.js"

export type WarehouseRepository = ReturnType<typeof createWarehouseRepository>
export type WarehouseService = ReturnType<typeof createWarehouseService>

export type PermissionChecker = Pick<typeof permissionChecker, "check">

/** Audit sink. `deps.ts` adapts the real activity-log service to this one method. */
export interface AuditEntry {
  orgId: string
  actorId: string
  /** `<module>.<event>`, taken from WAREHOUSE_AUDIT_EVENTS. */
  action: ActivityLogAction
  resourceId: string
  metadata?: Record<string, unknown>
}
export interface ActivityLog {
  record(entry: AuditEntry): Promise<void>
}

export interface WarehouseServiceDeps {
  repository: WarehouseRepository
  permissions: PermissionChecker
  activityLog: ActivityLog
  usage: WarehouseUsageRegistry
}

export type Code = WarehouseErrorCode | RoleErrorCode

/** Outcome of a repository write that can hit a named unique index. */
export type WriteResult<T> =
  | { ok: true; row: T }
  | { ok: false; reason: "code_taken" | "default_taken" }

export type { Tx, Warehouse }
export type {
  CreateWarehouseInput,
  DeleteWarehouseResult,
  OptionListResponse,
  Result,
  UpdateWarehouseInput,
  WarehouseDto,
  WarehouseOffsetListQuery,
  WarehouseOffsetListResponse,
  WarehouseOptionListQuery,
  WarehouseType,
}

export interface WarehouseListFilters {
  type?: WarehouseType
  isActive?: boolean
  search?: string
  page: number
  pageSize: number
}

export interface WarehouseOptionFilters {
  search?: string
  type?: WarehouseType
  includeSystem: boolean
  after: { name: string; id: string } | null
  limit: number
}

export type WarehousePatch = Partial<
  Pick<
    Warehouse,
    | "code"
    | "name"
    | "description"
    | "addressLine"
    | "city"
    | "region"
    | "postalCode"
    | "countryCode"
    | "isActive"
    | "isDefault"
  >
>
