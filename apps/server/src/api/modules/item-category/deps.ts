import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createItemCategoryRepository } from "./item-category.repository.js"
import { createItemCategoryService } from "./item-category.service.js"
import type { ItemCategoryRepository, ItemCategoryService } from "./item-category.types.js"

let _repoInstance: ItemCategoryRepository | undefined
let _serviceInstance: ItemCategoryService | undefined

export function getItemCategoryRepository(): ItemCategoryRepository {
  if (!_repoInstance) _repoInstance = createItemCategoryRepository({ db })
  return _repoInstance
}

export function getItemCategoryService(): ItemCategoryService {
  if (!_serviceInstance) {
    _serviceInstance = createItemCategoryService({
      repository: getItemCategoryRepository(),
      activityLog: activityLogService,
    })
  }
  return _serviceInstance
}

export const itemCategoryService = new Proxy({} as ItemCategoryService, {
  get(_target, prop) {
    return (getItemCategoryService() as any)[prop]
  },
})
