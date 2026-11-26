import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createInventoryProjection } from "../inventory-projection/index.js"
import { itemUnitAdapter, getPurchaseOrderRepository } from "../purchase-order/deps.js"
import { permissionChecker } from "../role/index.js"
import { createPurchaseShipmentRepository } from "./purchase-shipment.repository.js"
import { createPurchaseShipmentService, type PurchaseShipmentService } from "./purchase-shipment.service.js"
import type { PurchaseShipmentRepository } from "./purchase-shipment.types.js"

let _repo: PurchaseShipmentRepository | undefined
let _service: PurchaseShipmentService | undefined

export function getPurchaseShipmentRepository(): PurchaseShipmentRepository {
  return (_repo ??= createPurchaseShipmentRepository({ db }))
}

export function getPurchaseShipmentService(): PurchaseShipmentService {
  return (_service ??= createPurchaseShipmentService({
    repository: getPurchaseShipmentRepository(),
    orders: getPurchaseOrderRepository(),
    items: itemUnitAdapter,
    projection: createInventoryProjection({ db }),
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const purchaseShipmentService = new Proxy({} as PurchaseShipmentService, {
  get(_target, prop) {
    return (getPurchaseShipmentService() as any)[prop]
  },
})
