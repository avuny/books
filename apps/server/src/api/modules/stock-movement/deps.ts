import { db } from "../../db.js"
import { getBatchService } from "../batch/index.js"
// Adjust to the names the item and warehouse-location barrels export.
import { getItemRepository } from "../item/index.js"
import { getWarehouseLocationService } from "../warehouse-location/index.js"
import { createStockMovementRepository } from "./stock-movement.repository.js"
import { createStockMovementService } from "./stock-movement.service.js"
import type { StockMovementRepository, StockMovementService } from "./stock-movement.types.js"

let _repo: StockMovementRepository | undefined
let _service: StockMovementService | undefined

export function getStockMovementRepository(): StockMovementRepository {
  return (_repo ??= createStockMovementRepository({ db }))
}

export function getStockMovementService(): StockMovementService {
  return (_service ??= createStockMovementService({
    repository: getStockMovementRepository(),
    // The same gate every posting module uses; resolved lazily to avoid an import cycle.
    locations: {
      assertPostable: (orgId, locationId, intent, tx) =>
        getWarehouseLocationService().assertPostable(orgId, locationId, intent, tx),
    },
    batches: {
      findForPosting: (orgId, batchIds, tx) => getBatchService().findForPosting(orgId, batchIds, tx),
    },
    // See ITEM_CHANGES.md: findStockPolicies is a small query to add to the item repository.
    items: {
      findPolicies: (orgId, itemIds, tx) => getItemRepository().findStockPolicies(orgId, itemIds, tx),
    },
  }))
}

export const stockMovementService = new Proxy({} as StockMovementService, {
  get(_target, prop) {
    return (getStockMovementService() as any)[prop]
  },
})
