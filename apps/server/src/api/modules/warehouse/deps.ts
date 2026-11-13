import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { permissionChecker } from "../role/index.js"
import { createWarehouseRepository } from "./warehouse.repository.js"
import { createWarehouseService } from "./warehouse.service.js"
import type { ActivityLog, WarehouseService } from "./warehouse.types.js"
import { warehouseUsageRegistry } from "../shared/warehouse-usage.js"

let _serviceInstance: WarehouseService | undefined

export function getWarehouseService(): WarehouseService {
  if (!_serviceInstance) {
    const repository = createWarehouseRepository({ db })

    // The one place that knows the real activity-log API; adjust here if its method differs.
    const activityLog: ActivityLog = {
      record: (entry) => activityLogService.log(entry),
    }

    _serviceInstance = createWarehouseService({
      repository,
      permissions: permissionChecker,
      activityLog,
      usage: warehouseUsageRegistry,
    })
  }

  return _serviceInstance
}

export const warehouseService = new Proxy({} as WarehouseService, {
  get(_target, prop) {
    return (getWarehouseService() as any)[prop]
  },
})
