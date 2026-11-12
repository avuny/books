import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { PermissionChecker } from "../role/index.js"
import type { Tx } from "@avuny/db"
import type { createOrganizationRepository } from "./organization.repository.js"
import type { createOrganizationService } from "./organization.service.js"

export type OrganizationService = ReturnType<typeof createOrganizationService>
export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>

export type { PermissionChecker }

export interface Cache {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
}

export type { ActivityLog, ActivityLogEntry, Tx }

export interface OrganizationLimits {
  /** Max organizations a user may own (usually derived from their plan). */
  maxOwnedPerUser(userId: string): Promise<number>
}

export interface OrganizationServiceDeps {
  repo: OrganizationRepository
  permissions: PermissionChecker
  cache: Cache
  activityLog: ActivityLog
  limits: OrganizationLimits
}

