import type { UnitRepository } from "./unit.repository.js"
import type { UnitRules } from "./unit.rules.js"
import type { createUnitService } from "./unit.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type { UnitRepository }
export type UnitService = ReturnType<typeof createUnitService>

/** Plan gate: extra units in a collection are a paid feature (see the unit-collection rules). */
export interface UnitPlanFeatures {
  has(orgId: string, feature: "extraUnits"): Promise<boolean>
}

export type { ActivityLog, ActivityLogEntry }

export interface UnitServiceDeps {
  repository: UnitRepository
  features?: UnitPlanFeatures
  activityLog?: ActivityLog
  /** Pure business rules. Defaults to the real ones; inject a fake to test orchestration alone. */
  rules?: UnitRules
}
