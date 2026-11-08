import type {
  CreateOrganizationInvitationInput,
  InvitationPreviewDto,
  MyInvitationDto,
  OrganizationInvitationDto,
  OrganizationInvitationOffsetListQuery,
  OrganizationInvitationOffsetListResponse,
  AcceptMyInvitationInput,
  AcceptInvitationByTokenInput,
  OrganizationInvitationErrorCode as Code,
} from "@avuny/contracts"
import type {
  OrganizationInvitation,
  OrganizationUser,
  Organization,
  NewOrganizationInvitation,
  InvitationStatus,
  Tx,
  DB,
} from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { SQL } from "drizzle-orm"
import type { OrganizationUserService } from "../organization-user/index.js"
import type { RoleService } from "../role/index.js"
import type { ActivityLog } from "../activity-log/activity-log.port.js"
import type { createOrganizationInvitationService } from "./organization-invitation.service.js"
import type { createOrganizationInvitationRepository } from "./organization-invitation.repository.js"

/* -------------------------------------------------------------------------- */
/*                            Service & Repo Types                            */
/* -------------------------------------------------------------------------- */

/** Use this to type the service where it is injected (routes, container). */
export type OrganizationInvitationService = ReturnType<
  typeof createOrganizationInvitationService
>

export type OrganizationInvitationRepository = ReturnType<
  typeof createOrganizationInvitationRepository
>

/* -------------------------------------------------------------------------- */
/*                              Domain Interfaces                             */
/* -------------------------------------------------------------------------- */

export interface InvitationDelivery {
  invitation: {
    id: string
    identifier: string
    roleId?: string | null
    inviteeUserId?: string | null
    expiresAt: Date
  }
  org: { id: string; code: string; name: string }
  token: string
}

export interface InvitationNotifier {
  send(delivery: InvitationDelivery): Promise<void>
}

export interface UserDirectory {
  findVerifiedByContact(contact: {
    identifier?: string
    email?: string
    phone?: string
  }): Promise<{ userId: string } | null>

  getVerifiedContacts(
    userId: string
  ): Promise<{ emails: string[]; phones: string[] } | null>
}

export interface TokenGenerator {
  generate(): { token: string; hash: string }
  hash(token: string): string
}

export interface OrganizationInvitationServiceDeps {
  repo: OrganizationInvitationRepository
  organizationUserService: OrganizationUserService
  roleService: RoleService
  permissions: {
    check(
      actor: { userId: string },
      action: string,
      context: { orgId: string }
    ): Promise<boolean>
  }
  activityLog: ActivityLog
  limits: {
    getMax(orgId: string, resource: "managedUsers"): Promise<number | null>
  }
  users: UserDirectory
  notifier: InvitationNotifier
  tokens?: TokenGenerator
  now?: () => Date
}

/* -------------------------------------------------------------------------- */
/*                              Repository Types                              */
/* -------------------------------------------------------------------------- */

export type OrganizationSummary = Pick<
  Organization,
  "id" | "code" | "name" | "status" | "deletedAt"
>

export type InvitationWithOrganization = {
  invitation: OrganizationInvitation
  org: OrganizationSummary
  roleName?: string | null
}

export type ListInvitationsFilter = {
  status?: InvitationStatus
  page: number
  pageSize: number
}

export type InvitationTarget = {
  identifier?: string | null
  inviteeUserId?: string | null
}
