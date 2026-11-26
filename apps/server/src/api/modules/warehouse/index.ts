export { warehouseRoutes, createWarehouseRoutes } from "./hono-routes/index.js"
export { warehouseService, getWarehouseService } from "./deps.js"
export { createWarehouseService } from "./warehouse.service.js"
export { warehouseErrorsHttpMap } from "./warehouse.errors.js"
export { WAREHOUSE_PERMISSIONS } from "./warehouse.permissions.js"
// Other modules (inventory, purchasing, sales, transfers) register here so the warehouse modules
// can ask "does this warehouse or location hold stock / appear in open documents?".
export {
  warehouseUsageRegistry,
  createWarehouseUsageRegistry,
  type LocationUsage,
  type WarehouseUsage,
  type WarehouseUsageProvider,
  type WarehouseUsageRegistry,
} from "../shared/warehouse-usage.js"
export type { WarehouseService, WarehouseRepository, ActivityLog, AuditEntry } from "./warehouse.types.js"
