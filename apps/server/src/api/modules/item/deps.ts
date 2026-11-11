import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { getItemCategoryRepository } from "../item-category/deps.js"
import { getUnitCollectionRepository } from "../unit-collection/deps.js"
import { createItemRepository } from "./item.repository.js"
import { createItemService } from "./item.service.js"
import { DummyStockHistory } from "./testing.js"
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
      // TODO: replace with the inventory module's adapter once stock movements exist.
      stockHistory: new DummyStockHistory(),
      activityLog: activityLogService,
    })
  }
  return _serviceInstance
}

export const itemService = new Proxy({} as ItemService, {
  get(_target, prop) {
    return (getItemService() as any)[prop]
  },
})
