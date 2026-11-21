export { createStockMovementService } from "./stock-movement.service.js"
export { createStockMovementRepository } from "./stock-movement.repository.js"
export { stockMovementService, getStockMovementService, getStockMovementRepository } from "./deps.js"
export { stockMovementRoutes, createStockMovementRoutes } from "./hono-routes/index.js"
export type {
  StockItemPolicy,
  StockBatchInfo,
  StockBatchesPort,
  StockItemsPort,
  StockLocationsPort,
  StockMovementRepository,
  StockMovementService,
  StockMovementServiceDeps,
} from "./stock-movement.types.js"
