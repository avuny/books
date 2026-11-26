import type { createPartyRepository } from "./party.repository.js"
import type { createPartyService } from "./party.service.js"
import type { partyRules } from "./party.rules.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { PermissionKey } from "@avuny/contracts"

export type { ActivityLog, ActivityLogEntry }

export type PartyRepository = ReturnType<typeof createPartyRepository>
export type PartyRules = typeof partyRules
export type PartyService = ReturnType<typeof createPartyService>

export interface PermissionChecker {
  check(
    subject: { userId: string },
    key: PermissionKey,
    ctx?: { orgId?: string; resourceId?: string }
  ): Promise<boolean>
}

export interface PartyServiceDeps {
  repository: PartyRepository
  permissions: PermissionChecker
  activityLog?: ActivityLog
  rules?: PartyRules
}
