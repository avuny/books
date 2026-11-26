import type { DB, Tx } from "@avuny/db"
import type { createInventoryCostingRepository } from "./inventory-costing.repository.js"
import type { createInventoryCostingService } from "./inventory-costing.service.js"

export type InventoryCostingRepository = ReturnType<typeof createInventoryCostingRepository>
export type InventoryCostingService = ReturnType<typeof createInventoryCostingService>

export interface InventoryCostingServiceDeps {
  repository: InventoryCostingRepository
}
