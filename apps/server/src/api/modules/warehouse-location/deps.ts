import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { permissionChecker } from "../role/index.js"
import { warehouseUsageRegistry } from "../shared/warehouse-usage.js"
import type { ActivityLog } from "../warehouse/index.js"
import { createWarehouseLocationRepository } from "./warehouse-location.repository.js"
import { createWarehouseLocationService } from "./warehouse-location.service.js"
import type { WarehouseLocationService } from "./warehouse-location.types.js"

let _serviceInstance: WarehouseLocationService | undefined

export function getWarehouseLocationService(): WarehouseLocationService {
  if (!_serviceInstance) {
    const repository = createWarehouseLocationRepository({ db })

    // The one place that knows the real activity-log API; adjust here if its method differs.
    const activityLog: ActivityLog = {
      record: (entry) => activityLogService.log(entry),
    }

    _serviceInstance = createWarehouseLocationService({
      repository,
      permissions: permissionChecker,
      activityLog,
      usage: warehouseUsageRegistry,
    })
  }

  return _serviceInstance
}

export const warehouseLocationService = new Proxy({} as WarehouseLocationService, {
  get(_target, prop) {
    return (getWarehouseLocationService() as any)[prop]
  },
})
