import {
  ActivityLogAction,
  ORG_USER_AUDIT_EVENTS,
  type MyOrganizationDto,
  type OrganizationUserDto,
  type OrganizationUserOffsetListQuery,
  type OrganizationUserOffsetListResponse,
  type SetOrganizationUserStatusInput,
  type TransferOrganizationOwnershipInput,
  type UpdateOrganizationUserInput,
} from "@avuny/contracts"
import { fail, ok, type Result } from "@avuny/utils"
import type { OrganizationUser } from "@avuny/db"

import {
  OrganizationUserErrorCode,
  type OrganizationUserErrorCode as Code,
} from "./organization-user.errors.js"
import { toOrganizationUserDto } from "./organization-user.mapper.js"
import type {
  ActivityLog,
  ActivityLogEntry,
  InvitationChannelName,
  Limits,
  MemberLimitResource,
  OrganizationUserRepository,
  OrganizationUserService,
  OrganizationUserServiceDeps,
  PermissionChecker,
} from "./organization-user.types.js"
import {
  DummyActivityLog,
  DummyLimits,
  DummyPermissionChecker,
} from "./testing.js"

export type {
  PermissionChecker,
  ActivityLog,
  ActivityLogEntry,
  Limits,
  MemberLimitResource,
  InvitationChannelName,
  OrganizationUserServiceDeps,
  OrganizationUserService,
}

export {
  DummyPermissionChecker,
  DummyActivityLog,
  DummyLimits,
}

const Err = OrganizationUserErrorCode

/** `managed` / `portal` count against the plan; the owner does not. */
export const limitResourceFor = (
  type: "owner" | "managed" | "portal"
): MemberLimitResource | null =>
  type === "managed" ? "managedUsers" : type === "portal" ? "portalUsers" : null

/* ---------- internals ---------- */

const TOUCH_THROTTLE_MS = 60_000

type Failure = { failed: true; error: Code; msg: string }
const failure = (error: Code, msg: string): Failure => ({
  failed: true,
  error,
  msg,
})
const isFailure = (v: unknown): v is Failure =>
  typeof v === "object" && v !== null && (v as Failure).failed === true
const toFail = (f: Failure) => fail({ error: f.error, msg: f.msg })

const forbidden = () =>
  fail({
    error: Err.ORGANIZATION_USER_FORBIDDEN,
    msg: "You are not allowed to perform this action",
  })
const notFound = () =>
  fail({ error: Err.ORGANIZATION_USER_NOT_FOUND, msg: "Member not found" })

/**
 * Membership rules for `organization_users`. Invitations create members through
 * the invitation module, which reuses this module's repository.
 */
export function createOrganizationUserService(
  deps: OrganizationUserServiceDeps
) {
  const repo = deps.repository
  const permissions = deps.permissions ?? new DummyPermissionChecker()
  const activityLog = deps.activityLog ?? new DummyActivityLog()
  const limits = deps.limits ?? new DummyLimits()
  const clock = deps.now ?? (() => new Date())

  const can = (actorId: string, action: string, orgId: string) =>
    permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  return {
    async list(
      actorId: string,
      orgId: string,
      query: OrganizationUserOffsetListQuery
    ): Promise<Result<OrganizationUserOffsetListResponse, Code>> {
      if (!(await can(actorId, "read:organization-user", orgId)))
        return forbidden()
      const { rows, total } = await repo.list(orgId, query)
      return ok({
        data: {
          items: rows.map(toOrganizationUserDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Members retrieved successfully",
      })
    },

    /** The switcher: every organization the user actively belongs to. */
    async listMine(
      userId: string
    ): Promise<Result<{ items: MyOrganizationDto[] }, Code>> {
      const rows = await repo.listForUser(userId)
      return ok({
        data: {
          items: rows.map(({ membership, org }) => ({
            membershipId: membership.id,
            orgId: org.id,
            code: org.code,
            name: org.name,
            orgStatus: org.status,
            lastAccessedAt: membership.lastAccessedAt?.toISOString() ?? null,
          })),
        },
        msg: "Organizations retrieved successfully",
      })
    },

    /** Called when the user opens an organization; throttled to one write per minute. */
    async touch(
      userId: string,
      orgId: string
    ): Promise<Result<{ lastAccessedAt: string }, Code>> {
      const member = await repo.findByOrgAndUser(orgId, userId)
      if (!member || !member.isActive) return notFound()
      const now = clock()
      const last = member.lastAccessedAt
      if (last && now.getTime() - last.getTime() < TOUCH_THROTTLE_MS)
        return ok({
          data: { lastAccessedAt: last.toISOString() },
          msg: "Membership updated",
        })
      await repo.touch(orgId, member.id, now)
      return ok({
        data: { lastAccessedAt: now.toISOString() },
        msg: "Membership updated",
      })
    },

    async updateUsername(
      actorId: string,
      orgId: string,
      memberId: string,
      input: UpdateOrganizationUserInput
    ): Promise<Result<OrganizationUserDto, Code>> {
      if (!(await can(actorId, "update:organization-user", orgId)))
        return forbidden()
      const member = await repo.findById(orgId, memberId)
      if (!member) return notFound()
      // Only the owner can rename the owner.
      if (member.type === "owner" && member.userId !== actorId)
        return fail({
          error: Err.ORGANIZATION_USER_OWNER_PROTECTED,
          msg: "The owner cannot be changed this way",
        })
      if (member.username === input.username)
        return ok({ data: toOrganizationUserDto(member), msg: "Username updated" })

      // The unique index (org_id, username) is the race-safe guard.
      const res = await repo.updateUsername(orgId, memberId, input.username)
      if (!res.ok)
        return res.reason === "username_taken"
          ? fail({
            error: Err.ORGANIZATION_USER_USERNAME_TAKEN,
            msg: "This username is already used in the organization",
          })
          : notFound()

      await activityLog.log({
        action: ActivityLogAction.ORGANIZATION_USER_USERNAME_CHANGED,
        actorId,
        orgId,
        resourceId: memberId,
        metadata: { from: member.username, to: input.username },
      })
      return ok({ data: toOrganizationUserDto(res.row), msg: "Username updated" })
    },

    /** Offboard (`isActive: false`) or re-activate a member. Rows are never deleted. */
    async setStatus(
      actorId: string,
      orgId: string,
      memberId: string,
      input: SetOrganizationUserStatusInput
    ): Promise<Result<OrganizationUserDto, Code>> {
      if (!(await can(actorId, "deactivate:organization-user", orgId)))
        return forbidden()

      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgMembership(orgId, tx)
        const member = await repo.findById(orgId, memberId, tx)
        if (!member)
          return failure(Err.ORGANIZATION_USER_NOT_FOUND, "Member not found")
        if (member.type === "owner")
          return failure(
            Err.ORGANIZATION_USER_OWNER_PROTECTED,
            "The owner cannot be changed this way"
          )
        if (member.userId === actorId)
          return failure(
            Err.ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED,
            "You cannot do this to your own membership"
          )
        if (member.isActive === input.isActive)
          return { row: member, changed: false }

        if (input.isActive) {
          const resource = limitResourceFor(member.type)
          const max = resource ? await limits.getMax(orgId, resource) : null
          if (max !== null) {
            const active = await repo.countActiveByType(orgId, member.type, tx)
            if (active >= max)
              return failure(
                Err.ORGANIZATION_USER_LIMIT_REACHED,
                "The user limit for this member type has been reached"
              )
          }
        }
        const row = await repo.setActive(orgId, memberId, input.isActive, tx)
        if (!row)
          return failure(Err.ORGANIZATION_USER_NOT_FOUND, "Member not found")
        return { row, changed: true }
      })
      if (isFailure(outcome)) return toFail(outcome)

      if (outcome.changed)
        await activityLog.log({
          action: input.isActive
            ? ActivityLogAction.ORGANIZATION_USER_REACTIVATED
            : ActivityLogAction.ORGANIZATION_USER_DEACTIVATED,
          actorId,
          orgId,
          resourceId: memberId,
        })
      return ok({
        data: toOrganizationUserDto(outcome.row),
        msg: input.isActive ? "Member reactivated" : "Member deactivated",
      })
    },

    /**
     * Strict ownership transfer: only the current owner, the owner must retype the
     * organization code, and the target must be an active managed member.
     * Returns the new owner.
     */
    async transferOwnership(
      actorId: string,
      orgId: string,
      input: TransferOrganizationOwnershipInput
    ): Promise<Result<OrganizationUserDto, Code>> {
      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgMembership(orgId, tx)
        const org = await repo.findOrganization(orgId, tx)
        const owner = await repo.findByOrgAndUser(orgId, actorId, tx)
        if (!org || org.deletedAt || !owner || !owner.isActive || owner.type !== "owner")
          return failure(
            Err.ORGANIZATION_USER_FORBIDDEN,
            "You are not allowed to perform this action"
          )
        if (input.confirmCode !== org.code)
          return failure(
            Err.ORGANIZATION_USER_CONFIRMATION_MISMATCH,
            "The confirmation code does not match"
          )
        const target = await repo.findById(orgId, input.newOwnerMemberId, tx)
        if (!target)
          return failure(Err.ORGANIZATION_USER_NOT_FOUND, "Member not found")
        if (target.id === owner.id || !target.isActive || target.type !== "managed")
          return failure(
            Err.ORGANIZATION_USER_INVALID_OWNER_TARGET,
            "The new owner must be an active managed member"
          )

        const newOwner = await repo.transferOwnership(
          { orgId, fromId: owner.id, toId: target.id },
          tx
        )
        // Throw (not fail) so the demotion above is rolled back too.
        if (!newOwner) throw new Error("Ownership transfer invariant violated")
        return { newOwner, fromMemberId: owner.id }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ActivityLogAction.ORGANIZATION_OWNERSHIP_TRANSFERRED,
        actorId,
        orgId,
        resourceId: outcome.newOwner.id,
        metadata: {
          fromMemberId: outcome.fromMemberId,
          toMemberId: outcome.newOwner.id,
        },
      })
      return ok({
        data: toOrganizationUserDto(outcome.newOwner),
        msg: "Ownership transferred",
      })
    },

    async findMember(
      orgId: string,
      userId: string
    ): Promise<OrganizationUser | null> {
      return repo.findByOrgAndUser(orgId, userId)
    },

    async countActive(
      orgId: string,
      type: "owner" | "managed" | "portal"
    ): Promise<number> {
      return repo.countActiveByType(orgId, type)
    },

    async addMember(params: {
      orgId: string
      userId: string
      type?: "managed" | "portal"
      username?: string
    }): Promise<Result<OrganizationUser, Code>> {
      const type = params.type ?? "managed"
      const existing = await repo.findByOrgAndUser(params.orgId, params.userId)
      if (existing) {
        if (existing.isActive) {
          return fail({
            error: Err.ORGANIZATION_USER_FORBIDDEN,
            msg: "This person is already an active member",
          })
        }
        const reactivated = await repo.reactivate(
          params.orgId,
          existing.id,
          params.username ?? existing.username
        )
        if (!reactivated.ok) {
          return fail({
            error: Err.ORGANIZATION_USER_USERNAME_TAKEN,
            msg: "The username is already in use in this organization",
          })
        }
        return ok({
          data: reactivated.row,
          msg: "Member joined successfully",
        })
      }

      const username = params.username ?? `user_${params.userId.slice(0, 8)}`
      const inserted = await repo.insert({
        orgId: params.orgId,
        userId: params.userId,
        type,
        username,
        isActive: true,
      })

      if (!inserted.ok) {
        if (inserted.reason === "username_taken") {
          return fail({
            error: Err.ORGANIZATION_USER_USERNAME_TAKEN,
            msg: "The username is already in use in this organization",
          })
        }
        return fail({
          error: Err.ORGANIZATION_USER_FORBIDDEN,
          msg: "This person is already a member",
        })
      }

      return ok({
        data: inserted.row,
        msg: "Member joined successfully",
      })
    },
  }
}
