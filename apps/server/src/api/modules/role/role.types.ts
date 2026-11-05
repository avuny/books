import type { createRoleRepository } from "./role.repository.js"
import type { createRoleService } from "./role.service.js"
import type { createPermissionResolver } from "./role.permissions.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type RoleService = ReturnType<typeof createRoleService>
export type RoleRepository = ReturnType<typeof createRoleRepository>
export type PermissionResolver = ReturnType<typeof createPermissionResolver>

export interface Cache {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

export interface PermissionChecker {
  check(
    subject: { userId: string },
    action: string,
    ctx?: { orgId?: string; resourceId?: string }
  ): Promise<boolean>
}

export interface PlanFeatures {
  has(orgId: string, feature: "customRoles"): Promise<boolean>
}

export type { ActivityLog, ActivityLogEntry }

export interface RoleServiceDeps {
  repository: RoleRepository
  resolver: PermissionResolver
  features?: PlanFeatures
  activityLog?: ActivityLog
  now?: () => Date
}

export interface PermissionResolverDeps {
  repository: RoleRepository
  cache?: Cache
  ttlSeconds?: number
}

