import { and, eq } from "drizzle-orm"
import { stockMovementLines } from "@avuny/db"
import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { getBatchService } from "../batch/index.js"
import { getItemCategoryRepository } from "../item-category/deps.js"
import { permissionChecker } from "../role/index.js"
import { getStockMovementService } from "../stock-movement/index.js"
import { getUnitCollectionRepository } from "../unit-collection/deps.js"
import { createItemRepository } from "./item.repository.js"
import { createItemService } from "./item.service.js"
import type { ItemRepository, ItemService } from "./item.types.js"

let _repoInstance: ItemRepository | undefined
let _serviceInstance: ItemService | undefined

export function getItemRepository(): ItemRepository {
  if (!_repoInstance) _repoInstance = createItemRepository({ db })
  return _repoInstance
}

export function getItemService(): ItemService {
  if (!_serviceInstance) {
    _serviceInstance = createItemService({
      repository: getItemRepository(),
      unitRepository: getUnitCollectionRepository(),
      categoryRepository: getItemCategoryRepository(),
      stockHistory: {
        async hasMovements(orgId: string, itemId: string): Promise<boolean> {
          const [found] = await db
            .select({ id: stockMovementLines.id })
            .from(stockMovementLines)
            .where(and(eq(stockMovementLines.orgId, orgId), eq(stockMovementLines.itemId, itemId)))
            .limit(1)
          return !!found
        },
      },
      activityLog: activityLogService,
      permissions: permissionChecker,
      openingStock: {
        stockMovements: {
          post: (actorId, orgId, input, tx) => getStockMovementService().post(actorId, orgId, input, tx),
        },
        batches: {
          ensureBatches: (orgId, itemId, specs, tx) => getBatchService().ensureBatches(orgId, itemId, specs, tx),
        },
      },
    })
  }
  return _serviceInstance
}

export const itemService = new Proxy({} as ItemService, {
  get(_target, prop) {
    return (getItemService() as any)[prop]
  },
})
