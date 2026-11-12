import type { UnitCollectionRepository } from "./unit-collection.repository.js"
import type { UnitCollectionRules } from "./unit-collection.rules.js"
import type { createUnitCollectionService } from "./unit-collection.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { PermissionChecker } from "../role/index.js"

export type { UnitCollectionRepository, PermissionChecker }
export type UnitCollectionService = ReturnType<typeof createUnitCollectionService>

/** Plan gate: extra units in a collection are a paid feature. */
export interface UnitCollectionPlanFeatures {
  has(orgId: string, feature: "extraUnits"): Promise<boolean>
}

export type { ActivityLog, ActivityLogEntry }

export interface UnitCollectionServiceDeps {
  repository: UnitCollectionRepository
  permissions?: PermissionChecker
  features?: UnitCollectionPlanFeatures
  activityLog?: ActivityLog
  /** Pure business rules. */
  rules?: UnitCollectionRules
}

