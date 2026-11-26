import { randomBytes, createHash } from "node:crypto"
import {
  ORG_INVITATION_AUDIT_EVENTS,
  ORG_USER_AUDIT_EVENTS,
  OrganizationInvitationErrorCode,
  type AcceptInvitationByTokenInput,
  type AcceptMyInvitationInput,
  type CreateOrganizationInvitationInput,
  type InvitationPreviewDto,
  type MyInvitationDto,
  type OrganizationInvitationDto,
  type OrganizationInvitationOffsetListQuery,
  type OrganizationInvitationOffsetListResponse,
  type OrganizationUserDto,
  OrganizationUserErrorCode,
} from "@avuny/contracts"
import type { OrganizationInvitation, Tx } from "@avuny/db"
import { logger } from "@avuny/logger"
import { fail, ok, type Result } from "@avuny/utils"
import {
  organizationInvitationErrorsHttpMap as errors,
  type OrganizationInvitationErrorCode as Code,
} from "./organization-invitation.errors.js"
import {
  toInvitationPreviewDto,
  toMyInvitationDto,
  toOrganizationInvitationDto,
} from "./organization-invitation.mapper.js"
import { toOrganizationUserDto } from "../organization-user/index.js"
import type {
  InvitationDelivery,
  InvitationNotifier,
  OrganizationInvitationServiceDeps,
  TokenGenerator,
  UserDirectory,
} from "./organization-invitation.types.js"

export type {
  InvitationDelivery,
  InvitationNotifier,
  OrganizationInvitationServiceDeps,
  TokenGenerator,
  UserDirectory,
}

const Err = OrganizationInvitationErrorCode

/* ---------- policy ---------- */

export const INVITATION_TTL_DAYS = 7
export const RESEND_COOLDOWN_MS = 60_000
export const MAX_SEND_COUNT = 5

export const PERM = {
  create: "create:organization-invitation",
  read: "read:organization-invitation",
  update: "update:organization-invitation",
} as const

type PermissionKey = (typeof PERM)[keyof typeof PERM]

/* ---------- default crypto ---------- */

export class CryptoTokenGenerator implements TokenGenerator {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url")
    return { token, hash: this.hash(token) }
  }

  hash(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex")
  }
}

const MSG = {
  forbidden: "You are not allowed to perform this action",
  notFound: "Invitation not found",
  notPending: "This invitation is no longer pending",
  expired: "This invitation has expired",
  orgUnavailable: "This organization is not accepting new members",
} as const

const addDays = (d: Date, days: number) =>
  new Date(d.getTime() + days * 86_400_000)

type AcceptRef = { kind: "id"; id: string } | { kind: "token"; token: string }

export const createOrganizationInvitationService = ({
  repo,
  organizationUserService,
  roleService,
  permissions,
  activityLog,
  limits,
  users,
  notifier,
  tokens: customTokens,
  now: customNow,
}: OrganizationInvitationServiceDeps) => {
  const tokens = customTokens ?? new CryptoTokenGenerator()
  const clock = customNow ?? (() => new Date())

  const can = (actorId: string, action: PermissionKey, orgId: string) =>
    permissions.check({ userId: actorId }, action, { orgId })

  const forbidden = () =>
    fail({
      error: Err.ORGANIZATION_INVITATION_FORBIDDEN,
      msg: MSG.forbidden,
    })

  const notFound = () =>
    fail({
      error: Err.ORGANIZATION_INVITATION_NOT_FOUND,
      msg: MSG.notFound,
    })

  /** Delivery must never roll back a committed invitation; the caller can resend. */
  async function deliver(d: InvitationDelivery): Promise<boolean> {
    try {
      await notifier.send(d)
      return true
    } catch (err) {
      // Never log the token.
      logger.error(
        {
          err,
          invitationId: d.invitation.id,
          identifier: d.invitation.identifier,
        },
        "Invitation delivery failed"
      )
      return false
    }
  }

  const deliveryOf = (
    row: OrganizationInvitation,
    org: { id: string; code: string; name: string },
    token: string
  ): InvitationDelivery => ({
    invitation: {
      id: row.id,
      identifier: row.identifier,
      roleId: row.roleId,
      inviteeUserId: row.inviteeUserId,
      expiresAt: row.expiresAt,
    },
    org,
    token,
  })

  /* ---------- accept (shared by id / token) ---------- */

  async function accept(
    userId: string,
    ref: AcceptRef
  ): Promise<Result<OrganizationUserDto, Code>> {
    const now = clock()
    const tokenHash = ref.kind === "token" ? tokens.hash(ref.token) : null
    const contact =
      ref.kind === "token" ? await users.getVerifiedContacts(userId) : null

    const row =
      ref.kind === "token"
        ? await repo.findByTokenHash(tokenHash!)
        : await repo.findForInvitee(ref.id, userId)

    if (!row) return notFound()

    // Identity check: targeted invite must match user; open token needs matching verified contact
    if (row.inviteeUserId && row.inviteeUserId !== userId) return notFound()
    if (!row.inviteeUserId) {
      const matches = Boolean(
        contact?.emails.some(
          (e) => e.toLowerCase() === row.identifier.toLowerCase()
        ) || contact?.phones.some((p) => p === row.identifier)
      )
      if (!matches) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_IDENTITY_MISMATCH,
          msg: "This invitation was sent to a different verified email or phone",
        })
      }
    }

    if (row.status !== "pending") {
      return fail({
        error:
          row.status === "expired"
            ? Err.ORGANIZATION_INVITATION_EXPIRED
            : Err.ORGANIZATION_INVITATION_NOT_PENDING,
        msg: row.status === "expired" ? MSG.expired : MSG.notPending,
      })
    }

    if (row.expiresAt <= now) {
      await repo.markExpired(row.id)
      return fail({
        error: Err.ORGANIZATION_INVITATION_EXPIRED,
        msg: MSG.expired,
      })
    }

    const org = await repo.findOrganization(row.orgId)
    if (!org || org.deletedAt || org.status !== "active") {
      return fail({
        error: Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
        msg: MSG.orgUnavailable,
      })
    }

    // Check if already an active member
    const existing = await organizationUserService.findMember(row.orgId, userId)
    if (existing?.isActive) {
      return fail({
        error: Err.ORGANIZATION_INVITATION_ALREADY_MEMBER,
        msg: "You are already a member of this organization",
      })
    }

    // Check plan limits
    const max = await limits.getMax(row.orgId, "managedUsers")
    if (max !== null) {
      const active = await organizationUserService.countActive(
        row.orgId,
        "managed"
      )
      if (active >= max) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_LIMIT_REACHED,
          msg: "The user limit has been reached",
        })
      }
    }

    // Add or reactivate member through organizationUserService
    const memberResult = await organizationUserService.addMember({
      orgId: row.orgId,
      userId,
      type: "managed",
    })

    if (!memberResult.success) {
      if (
        memberResult.error ===
        OrganizationUserErrorCode.ORGANIZATION_USER_USERNAME_TAKEN
      ) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_USERNAME_TAKEN,
          msg: "The username is already in use in this organization",
        })
      }
      return fail({
        error: Err.ORGANIZATION_INVITATION_ALREADY_MEMBER,
        msg: "You are already a member of this organization",
      })
    }

    const member = memberResult.data

    // Assign role if specified on invitation
    if (row.roleId) {
      const inviterMember = await organizationUserService.findMemberById(
        row.orgId,
        row.invitedBy
      )
      await roleService.assignRole({
        orgId: row.orgId,
        memberId: member.id,
        roleId: row.roleId,
        assignedByUserId: inviterMember?.userId ?? null,
      })
    }

    // Mark invitation accepted and revoke other pending
    await repo.transaction(async (tx) => {
      await repo.markAccepted(
        row.id,
        { acceptedOrgUserId: member.id, inviteeUserId: userId, now },
        tx
      )
      await repo.revokeOtherPending(
        row.orgId,
        row.id,
        { inviteeUserId: userId, identifier: row.identifier },
        now,
        tx
      )
    })

    await activityLog.log({
      action: ORG_INVITATION_AUDIT_EVENTS.ACCEPTED,
      actorId: userId,
      orgId: member.orgId,
      resource: "organization_invitation",
      resourceId: row.id,
    })
    await activityLog.log({
      action: ORG_USER_AUDIT_EVENTS.JOINED,
      actorId: userId,
      orgId: member.orgId,
      resource: "organization_user",
      resourceId: member.id,
    })

    return ok({
      data: toOrganizationUserDto(member),
      msg: "You joined the organization",
    })
  }

  return {
    /* ------------------------------ manager side ------------------------------ */

    async create(
      actorId: string,
      orgId: string,
      input: CreateOrganizationInvitationInput
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      if (!(await can(actorId, PERM.create, orgId))) return forbidden()

      const identifier = input.identifier.trim().toLowerCase()

      if (!input.roleId) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_ROLE_NOT_FOUND,
          msg: "The specified role was not found",
        })
      }

      const roleResult = await roleService.getById(orgId, input.roleId)
      if (!roleResult.success) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_ROLE_NOT_FOUND,
          msg: "The specified role was not found",
        })
      }

      // Check inviter membership
      const inviter = await organizationUserService.findMember(orgId, actorId)
      if (!inviter || !inviter.isActive) return forbidden()

      // Resolve invitee if account already exists
      const found = await users.findVerifiedByContact({
        identifier,
        email: identifier,
      })
      const inviteeUserId = found?.userId ?? null

      if (inviteeUserId) {
        const existing = await organizationUserService.findMember(
          orgId,
          inviteeUserId
        )
        if (existing?.isActive) {
          return fail({
            error: Err.ORGANIZATION_INVITATION_ALREADY_MEMBER,
            msg: "This person is already a member",
          })
        }
      }

      const now = clock()
      const issued = tokens.generate()

      // Check plan limits
      const max = await limits.getMax(orgId, "managedUsers")
      if (max !== null) {
        const active = await organizationUserService.countActive(
          orgId,
          "managed"
        )
        const pending = await repo.countPending(orgId, now)
        if (active + pending >= max) {
          return fail({
            error: Err.ORGANIZATION_INVITATION_LIMIT_REACHED,
            msg: "The user limit has been reached",
          })
        }
      }

      const outcome = await repo.transaction(async (tx) => {
        const org = await repo.findOrganization(orgId, tx)
        if (!org || org.deletedAt || org.status !== "active") {
          return {
            failed: true as const,
            error: Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
            msg: MSG.orgUnavailable,
          }
        }

        await repo.expireStaleForTarget(
          orgId,
          { identifier, inviteeUserId },
          now,
          tx
        )

        const res = await repo.insert(
          {
            orgId,
            identifier,
            roleId: input.roleId,
            inviteeUserId,
            tokenHash: issued.hash,
            status: "pending",
            invitedBy: inviter.id,
            expiresAt: addDays(now, INVITATION_TTL_DAYS),
            lastSentAt: now,
            sendCount: 1,
          },
          tx
        )

        if (!res.ok) {
          return {
            failed: true as const,
            error: Err.ORGANIZATION_INVITATION_ALREADY_PENDING,
            msg: "There is already a pending invitation for this person",
          }
        }

        return { failed: false as const, row: res.row, org }
      })

      if (outcome.failed) {
        return fail({ error: outcome.error, msg: outcome.msg })
      }

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.CREATED,
        actorId,
        orgId,
        resource: "organization_invitation",
        resourceId: outcome.row.id,
        metadata: {
          identifier: outcome.row.identifier,
          roleId: outcome.row.roleId,
        },
      })

      const delivered = await deliver(
        deliveryOf(outcome.row, outcome.org, issued.token)
      )

      return ok({
        data: toOrganizationInvitationDto(outcome.row, now),
        msg: delivered
          ? "Invitation sent"
          : "Invitation created, but delivery failed. You can resend it",
      })
    },

    async list(
      actorId: string,
      orgId: string,
      query: OrganizationInvitationOffsetListQuery
    ): Promise<Result<OrganizationInvitationOffsetListResponse, Code>> {
      if (!(await can(actorId, PERM.read, orgId))) return forbidden()
      const now = clock()
      const { rows, total } = await repo.list(orgId, query, now)
      return ok({
        data: {
          items: rows.map((r) => toOrganizationInvitationDto(r, now)),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Invitations retrieved successfully",
      })
    },

    async revoke(
      actorId: string,
      orgId: string,
      invitationId: string
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      if (!(await can(actorId, PERM.update, orgId))) return forbidden()
      const now = clock()

      const row = await repo.findInOrg(orgId, invitationId)
      if (!row) return notFound()
      if (row.status !== "pending") {
        return fail({
          error: Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: MSG.notPending,
        })
      }

      const revoked = await repo.markRevoked(row.id, now)
      if (!revoked) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: MSG.notPending,
        })
      }

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.REVOKED,
        actorId,
        orgId,
        resource: "organization_invitation",
        resourceId: revoked.id,
      })

      return ok({
        data: toOrganizationInvitationDto(revoked, now),
        msg: "Invitation revoked",
      })
    },

    async resend(
      actorId: string,
      orgId: string,
      invitationId: string
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      if (!(await can(actorId, PERM.update, orgId))) return forbidden()
      const now = clock()
      const issued = tokens.generate()

      const row = await repo.findInOrg(orgId, invitationId)
      if (!row) return notFound()
      if (row.status !== "pending") {
        return fail({
          error: Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: MSG.notPending,
        })
      }
      if (row.expiresAt <= now) {
        await repo.markExpired(row.id)
        return fail({
          error: Err.ORGANIZATION_INVITATION_EXPIRED,
          msg: MSG.expired,
        })
      }
      if (row.sendCount >= MAX_SEND_COUNT) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED,
          msg: "This invitation was resent too many times",
        })
      }
      if (now.getTime() - row.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_RESEND_TOO_SOON,
          msg: "Please wait before resending this invitation",
        })
      }

      const org = await repo.findOrganization(orgId)
      if (!org || org.deletedAt || org.status !== "active") {
        return fail({
          error: Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
          msg: MSG.orgUnavailable,
        })
      }

      const rotated = await repo.rotateToken(row.id, {
        tokenHash: issued.hash,
        expiresAt: addDays(now, INVITATION_TTL_DAYS),
        now,
      })
      if (!rotated) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: MSG.notPending,
        })
      }

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.RESENT,
        actorId,
        orgId,
        resource: "organization_invitation",
        resourceId: rotated.id,
        metadata: { identifier: rotated.identifier },
      })

      const delivered = await deliver(
        deliveryOf(rotated, org, issued.token)
      )

      return ok({
        data: toOrganizationInvitationDto(rotated, now),
        msg: delivered
          ? "Invitation resent"
          : "Delivery failed. Try again shortly",
      })
    },

    /* ------------------------------ invitee side ------------------------------ */

    /** Public: what the sign-up / accept page shows for a link. */
    async preview(token: string): Promise<Result<InvitationPreviewDto, Code>> {
      const found = await repo.findPreviewByTokenHash(tokens.hash(token))
      if (!found) return notFound()
      const { invitation, org, roleName: previewRoleName } = found

      if (invitation.status !== "pending") {
        return fail({
          error:
            invitation.status === "expired"
              ? Err.ORGANIZATION_INVITATION_EXPIRED
              : Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: invitation.status === "expired" ? MSG.expired : MSG.notPending,
        })
      }
      if (invitation.expiresAt <= clock()) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_EXPIRED,
          msg: MSG.expired,
        })
      }
      if (org.deletedAt || org.status !== "active") {
        return fail({
          error: Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
          msg: MSG.orgUnavailable,
        })
      }

      let roleName: string | null = previewRoleName ?? null
      if (!roleName && invitation.roleId) {
        const roleRes = await roleService.getById(
          invitation.orgId,
          invitation.roleId
        )
        if (roleRes.success) {
          roleName = roleRes.data.name
        }
      }

      return ok({
        data: toInvitationPreviewDto(invitation, org, roleName),
        msg: "Invitation retrieved successfully",
      })
    },

    async listMine(
      userId: string
    ): Promise<Result<{ items: MyInvitationDto[] }, Code>> {
      const rows = await repo.listPendingForUser(userId, clock())
      return ok({
        data: {
          items: rows.map(({ invitation, org, roleName }) =>
            toMyInvitationDto(invitation, org, roleName)
          ),
        },
        msg: "Invitations retrieved successfully",
      })
    },

    /** Accept from the dashboard inbox (invitation addressed to this user). */
    acceptMine(
      userId: string,
      invitationId: string,
      _input?: AcceptMyInvitationInput
    ) {
      return accept(userId, { kind: "id", id: invitationId })
    },

    /** Accept from an emailed link by a signed-in user. */
    acceptByToken(userId: string, input: AcceptInvitationByTokenInput) {
      return accept(userId, { kind: "token", token: input.token })
    },

    async decline(
      userId: string,
      invitationId: string
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      const now = clock()
      const row = await repo.findForInvitee(invitationId, userId)
      if (!row) return notFound()
      if (row.status !== "pending") {
        return fail({
          error: Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: MSG.notPending,
        })
      }
      if (row.expiresAt <= now) {
        await repo.markExpired(row.id)
        return fail({
          error: Err.ORGANIZATION_INVITATION_EXPIRED,
          msg: MSG.expired,
        })
      }

      const declined = await repo.markDeclined(row.id, now)
      if (!declined) {
        return fail({
          error: Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: MSG.notPending,
        })
      }

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.DECLINED,
        actorId: userId,
        orgId: declined.orgId,
        resource: "organization_invitation",
        resourceId: declined.id,
      })

      return ok({
        data: toOrganizationInvitationDto(declined, now),
        msg: "Invitation declined",
      })
    },

    /* ------------------------------ system hooks ------------------------------ */

    async linkPendingInvitations(
      userId: string,
      contact: {
        identifier?: string | null
        email?: string | null
        phone?: string | null
      }
    ): Promise<number> {
      const now = clock()
      const identifier = contact.identifier ?? contact.email ?? contact.phone
      const candidates = await repo.findLinkCandidates({ identifier }, now)
      if (!candidates.length) return 0
      const alreadyLinkedOrgs = new Set(
        await repo.listPendingOrgIdsForUser(userId, now)
      )
      const ids: string[] = []
      for (const c of candidates) {
        if (alreadyLinkedOrgs.has(c.orgId)) continue
        alreadyLinkedOrgs.add(c.orgId)
        ids.push(c.id)
      }
      return repo.linkInvitee(ids, userId)
    },

    expireDueInvitations(): Promise<number> {
      return repo.expireAllDue(clock())
    },
  }
}
