import type { ItemCategoryRepository } from "../item-category/item-category.repository.js"
import type { UnitCollectionRepository } from "../unit-collection/unit-collection.repository.js"
import type { ItemRepository } from "./item.repository.js"
import type { ItemRules } from "./item.rules.js"
import type { createItemService } from "./item.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { PermissionChecker } from "../role/index.js"

export type { ItemRepository, PermissionChecker }
export type ItemService = ReturnType<typeof createItemService>

/**
 * Port to the (future) inventory module. Until stock movements exist, the Dummy answers
 * "no history", so unit/tracking fields stay editable and items stay deletable.
 */
export interface ItemStockHistory {
  hasMovements(orgId: string, itemId: string): Promise<boolean>
}

export type { ActivityLog, ActivityLogEntry }

export interface ItemServiceDeps {
  repository: ItemRepository
  permissions?: PermissionChecker
  /** Only what item creation needs from the unit module. */
  unitRepository: Pick<
    UnitCollectionRepository,
    "findUnitsByIds" | "findCollection" | "insertCollection" | "insertCollectionUnits"
  >
  /** Only what the item needs from the category module. */
  categoryRepository: Pick<ItemCategoryRepository, "findById">
  stockHistory?: ItemStockHistory
  activityLog?: ActivityLog
  /** Pure business rules. Defaults to the real ones; inject a fake to test orchestration alone. */
  rules?: ItemRules
}
