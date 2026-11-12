import type { ItemCategoryRepository } from "./item-category.repository.js"
import type { ItemCategoryRules } from "./item-category.rules.js"
import type { createItemCategoryService } from "./item-category.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { PermissionChecker } from "../role/index.js"

export type { ItemCategoryRepository, PermissionChecker }
export type ItemCategoryService = ReturnType<typeof createItemCategoryService>

export type { ActivityLog, ActivityLogEntry }

export interface ItemCategoryServiceDeps {
  repository: ItemCategoryRepository
  permissions?: PermissionChecker
  activityLog?: ActivityLog
  /** Pure tree rules. Defaults to the real ones; inject a fake to test orchestration alone. */
  rules?: ItemCategoryRules
}
