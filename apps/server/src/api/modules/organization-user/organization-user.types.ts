import type { createOrganizationUserRepository } from "./organization-user.repository.js"
import type { createOrganizationUserService } from "./organization-user.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type OrganizationUserService = ReturnType<
  typeof createOrganizationUserService
>
export type OrganizationUserRepository = ReturnType<
  typeof createOrganizationUserRepository
>

export interface PermissionChecker {
  check(
    subject: { userId: string },
    action: string,
    ctx?: { resourceId?: string; orgId?: string }
  ): Promise<boolean>
}

export type { ActivityLog, ActivityLogEntry }

/** Plan limits. `null` means unlimited. */
export type MemberLimitResource = "managedUsers" | "portalUsers"
export type InvitationChannelName = "email" | "whatsapp"

export interface Limits {
  getMax(orgId: string, resource: MemberLimitResource): Promise<number | null>
  isChannelAllowed(orgId: string, channel: InvitationChannelName): Promise<boolean>
}

export interface OrganizationUserServiceDeps {
  repository: OrganizationUserRepository
  permissions?: PermissionChecker
  activityLog?: ActivityLog
  limits?: Limits
  now?: () => Date
}

