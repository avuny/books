import type { ItemCategoryRepository } from "../item-category/item-category.repository.js"
import type { UnitRepository } from "../unit/unit.repository.js"
import type { ItemRepository } from "./item.repository.js"
import type { ItemRules } from "./item.rules.js"
import type { createItemService } from "./item.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type { ItemRepository }
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
  /** Only what item creation needs from the unit module. */
  unitRepository: Pick<
    UnitRepository,
    "findUnitsByIds" | "findCollection" | "insertCollection" | "insertCollectionUnits"
  >
  /** Only what the item needs from the category module. */
  categoryRepository: Pick<ItemCategoryRepository, "findById">
  stockHistory?: ItemStockHistory
  activityLog?: ActivityLog
  /** Pure business rules. Defaults to the real ones; inject a fake to test orchestration alone. */
  rules?: ItemRules
}
