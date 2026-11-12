import type { createRoleRepository } from "./role.repository.js"
import type { createRoleService } from "./role.service.js"
import type { createPermissionResolver } from "./role.permissions.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { PermissionKey } from "@avuny/contracts"

export type { PermissionKey }

export type RoleService = ReturnType<typeof createRoleService>
export type RoleRepository = ReturnType<typeof createRoleRepository>
export type PermissionResolver = ReturnType<typeof createPermissionResolver>

export interface Cache {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

export interface PermissionChecker {
  /** Check a single permission key — returns true if granted. */
  check(
    subject: { userId: string },
    key: PermissionKey,
    ctx?: { orgId?: string; resourceId?: string }
  ): Promise<boolean>
  /**
   * Check an array of permission keys (any-of / OR).
   * Returns true as soon as one key is granted; false only when none are.
   */
  check(
    subject: { userId: string },
    keys: readonly [PermissionKey, ...PermissionKey[]],
    ctx?: { orgId?: string; resourceId?: string }
  ): Promise<boolean>
  /** Check a single key or an array of keys (any-of / OR). */
  check(
    subject: { userId: string },
    keyOrKeys: PermissionKey | readonly [PermissionKey, ...PermissionKey[]],
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

