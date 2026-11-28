import { db } from "../../db.js"
import { createInventoryCostingRepository } from "./inventory-costing.repository.js"
import { createInventoryCostingService } from "./inventory-costing.service.js"
import { createValuationEngine } from "./valuation-engine.js"
import { createWacStrategy } from "./wac-strategy.js"
import type { InventoryCostingRepository, InventoryCostingService } from "./inventory-costing.types.js"

let _repo: InventoryCostingRepository | undefined
let _service: InventoryCostingService | undefined

export function getInventoryCostingRepository(): InventoryCostingRepository {
  return (_repo ??= createInventoryCostingRepository({ db }))
}

export function getInventoryCostingService(): InventoryCostingService {
  return (_service ??= createInventoryCostingService({
    repository: getInventoryCostingRepository(),
  }))
}

/** The valuation engine with both strategies wired (FIFO layers and weighted average pools). */
export function getValuationEngine() {
  return createValuationEngine({
    costing: getInventoryCostingService(),
    wac: createWacStrategy({ repository: getInventoryCostingRepository() }),
  })
}

export const inventoryCostingService = new Proxy({} as InventoryCostingService, {
  get(_target, prop) {
    return (getInventoryCostingService() as any)[prop]
  },
})
