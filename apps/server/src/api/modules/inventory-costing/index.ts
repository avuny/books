export { createInventoryCostingRepository } from "./inventory-costing.repository.js"
export { createInventoryCostingService } from "./inventory-costing.service.js"
export {
  inventoryCostingService,
  getInventoryCostingService,
  getInventoryCostingRepository,
  getValuationEngine,
} from "./deps.js"
export type {
  InventoryCostingRepository,
  InventoryCostingService,
  InventoryCostingServiceDeps,
} from "./inventory-costing.types.js"
export type { CreateCostLayerInput, RecordAllocationInput } from "./inventory-costing.service.js"
export { createValuationEngine, toEngineMethod } from "./valuation-engine.js"
export type { ValuationEngine, ReceiveInput, IssueInput, IssueResult, EngineFailure } from "./valuation-engine.js"
export { createWacStrategy } from "./wac-strategy.js"
export type { WacStrategy, WacFailure, WacEntryResult } from "./wac-strategy.js"
