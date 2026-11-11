import type { UnitRepository } from "./unit.repository.js"
import type { UnitRules } from "./unit.rules.js"
import type { createUnitService } from "./unit.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type { UnitRepository }
export type UnitService = ReturnType<typeof createUnitService>

export type { ActivityLog, ActivityLogEntry }

export interface UnitServiceDeps {
  repository: UnitRepository
  activityLog?: ActivityLog
  rules?: UnitRules
}
