import type { PermissionChecker } from "../role/index.js"
import type { UnitRepository } from "./unit.repository.js"
import type { UnitRules } from "./unit.rules.js"
import type { createUnitService } from "./unit.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type { UnitRepository, PermissionChecker }
export type UnitService = ReturnType<typeof createUnitService>

export type { ActivityLog, ActivityLogEntry }

export interface UnitServiceDeps {
  repository: UnitRepository
  permissions?: PermissionChecker
  activityLog?: ActivityLog
  rules?: UnitRules
}
