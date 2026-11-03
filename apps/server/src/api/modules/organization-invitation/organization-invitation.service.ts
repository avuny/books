import { createHash, randomBytes } from "node:crypto"
import {
  ORG_INVITATION_AUDIT_EVENTS,
  ORG_USER_AUDIT_EVENTS,
  type AcceptInvitationByTokenInput,
  type AcceptMyInvitationInput,
  type CreateOrganizationInvitationInput,
  type InvitationPreviewDto,
  type MyInvitationDto,
  type OrganizationInvitationDto,
  type OrganizationInvitationOffsetListQuery,
  type OrganizationInvitationOffsetListResponse,
  type OrganizationUserDto,
  type PermissionKey,
} from "@avuny/contracts"
import type { OrganizationInvitation, Tx } from "@avuny/db"
import { logger } from "@avuny/logger"
import { fail, ok, type Result } from "@avuny/utils"
import {
  toOrganizationUserDto,
  type Limits,
  type OrganizationUserRepository,
} from "../organization-user/index.js"
import type { RoleRepository } from "../role/index.js"
import type { ActivityLog } from "../activity-log/index.js"
import {
  OrganizationInvitationErrorCode,
  type OrganizationInvitationErrorCode as Code,
} from "./organization-invitation.errors.js"
import {
  toInvitationPreviewDto,
  toMyInvitationDto,
  toOrganizationInvitationDto,
} from "./organization-invitation.mapper.js"
import type { OrganizationInvitationRepository } from "./organization-invitation.repository.js"

const Err = OrganizationInvitationErrorCode

/* ---------- policy ---------- */

export const INVITATION_TTL_DAYS = 7
export const RESEND_COOLDOWN_MS = 60_000
export const MAX_SEND_COUNT = 5

/* ---------- ports ---------- */

export interface PermissionChecker {
  check(
    actor: { userId: string; orgId: string },
    action: PermissionKey,
    opts?: { resourceId?: string }
  ): Promise<boolean>
}

/** Verified contacts of a user. A user can hold several, primary first. */
export interface VerifiedContacts {
  emails: string[]
  phones: string[]
}

/** Reads of the users table owned by the auth module. Contacts MUST be verified ones. */
export interface UserDirectory {
  /** Verified user matching the identifier (e.g. email); null if none. */
  findVerifiedByContact(c: {
    identifier?: string | null
    email?: string | null
    phone?: string | null
  }): Promise<{ userId: string } | null>
  /** Verified contact details of a user; null when the user does not exist. */
  getVerifiedContacts(userId: string): Promise<VerifiedContacts | null>
}

export interface InvitationDelivery {
  invitation: {
    id: string
    identifier: string
    roleId: string | null
    inviteeUserId: string | null
    expiresAt: Date
  }
  org: { id: string; code: string; name: string }
  /** Plaintext one-time token. Exists only here; the database keeps its hash. */
  token: string
}
export interface InvitationNotifier {
  send(delivery: InvitationDelivery): Promise<void>
}

export interface TokenGenerator {
  generate(): { token: string; hash: string }
  hash(token: string): string
}

/** 256-bit random token; SHA-256 is enough because the token is high-entropy. */
export class CryptoTokenGenerator implements TokenGenerator {
  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex")
  }
  generate() {
    const token = randomBytes(32).toString("base64url")
    return { token, hash: this.hash(token) }
  }
}

/* ---------- internals ---------- */

/** Compile-time check that every key exists in the permission registry. */
const PERM = {
  create: "create:organization-invitation",
  read: "read:organization-invitation",
  update: "update:organization-invitation",
} as const satisfies Record<string, PermissionKey>

type Failure = { failed: true; error: Code; msg: string }
const failure = (error: Code, msg: string): Failure => ({ failed: true, error, msg })
const isFailure = (v: unknown): v is Failure =>
  typeof v === "object" && v !== null && (v as Failure).failed === true
const toFail = (f: Failure) => fail({ error: f.error, msg: f.msg })

const MSG = {
  forbidden: "You are not allowed to manage invitations",
  notFound: "Invitation not found",
  notPending: "This invitation is no longer pending",
  expired: "This invitation has expired",
  orgUnavailable: "This organization is not accepting new members",
} as const

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000)

type AcceptRef = { kind: "id"; id: string } | { kind: "token"; token: string }

export interface OrganizationInvitationServiceDeps {
  repository: OrganizationInvitationRepository
  /** Membership writes reuse the organization-user repository so both share one lock + tx. */
  members: OrganizationUserRepository
  roles?: RoleRepository
  permissions: PermissionChecker
  activityLog: ActivityLog
  limits: Limits
  users: UserDirectory
  notifier: InvitationNotifier
  /** Pure crypto, so the default is fine. */
  tokens?: TokenGenerator
  now?: () => Date
}

export function createOrganizationInvitationService(
  deps: OrganizationInvitationServiceDeps
) {
  const repo = deps.repository
  const members = deps.members
  const rolesRepo = deps.roles
  const { permissions, activityLog, limits, users, notifier } = deps
  const tokens = deps.tokens ?? new CryptoTokenGenerator()
  const clock = deps.now ?? (() => new Date())

  const can = (actorId: string, action: PermissionKey, orgId: string) =>
    permissions.check({ userId: actorId, orgId }, action)

  /** Delivery must never roll back a committed invitation; the caller can resend. */
  async function deliver(d: InvitationDelivery): Promise<boolean> {
    try {
      await notifier.send(d)
      return true
    } catch (err) {
      // Never log the token.
      logger.error(
        { err, invitationId: d.invitation.id, identifier: d.invitation.identifier },
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

  /**
   * Reads an invitation, takes the org lock, and re-reads it, so the checks that follow
   * run against state no concurrent invite/accept/revoke can change.
   */
  async function lockedInvitation(
    tx: Tx,
    load: () => Promise<OrganizationInvitation | null>
  ): Promise<OrganizationInvitation | null> {
    const probe = await load()
    if (!probe) return null
    await members.lockOrgMembership(probe.orgId, tx)
    return load()
  }

  /** Generates a safe lowercase handle for a new member joining without a specified handle. */
  async function resolveMemberUsername(
    orgId: string,
    identifier: string,
    existingUsername: string | null | undefined,
    tx: Tx
  ): Promise<string> {
    if (existingUsername) return existingUsername
    const raw = (identifier.split("@")[0] ?? "user").toLowerCase().replace(/[^a-z0-9_]/g, "_")
    const base = (raw.length < 3 ? `${raw}usr` : raw).slice(0, 24)
    let candidate = base
    let counter = 1
    while (await members.findByUsername(orgId, candidate, tx)) {
      candidate = `${base.slice(0, 20)}_${counter++}`
    }
    return candidate
  }

  /* ---------- accept (shared by id / token) ---------- */

  async function accept(
    userId: string,
    ref: AcceptRef
  ): Promise<Result<OrganizationUserDto, Code>> {
    const now = clock()
    const tokenHash = ref.kind === "token" ? tokens.hash(ref.token) : null
    // External read outside the transaction: the user's VERIFIED contacts.
    const contact = ref.kind === "token" ? await users.getVerifiedContacts(userId) : null

    const outcome = await repo.transaction(async (tx) => {
      const row = await lockedInvitation(tx, () =>
        ref.kind === "token"
          ? repo.findByTokenHash(tokenHash!, tx)
          : repo.findForInvitee(ref.id, userId, tx)
      )
      if (!row) return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)

      // Identity: an invite addressed to a user is theirs only; an open link needs a
      // verified contact that matches the invited one.
      if (row.inviteeUserId && row.inviteeUserId !== userId)
        return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)
      if (!row.inviteeUserId) {
        const matches = !!(
          contact?.emails.some((e) => e.toLowerCase() === row.identifier.toLowerCase()) ||
          contact?.phones.some((p) => p === row.identifier)
        )
        if (!matches)
          return failure(
            Err.ORGANIZATION_INVITATION_IDENTITY_MISMATCH,
            "This invitation was sent to a different verified email"
          )
      }

      if (row.status !== "pending")
        return failure(
          row.status === "expired"
            ? Err.ORGANIZATION_INVITATION_EXPIRED
            : Err.ORGANIZATION_INVITATION_NOT_PENDING,
          row.status === "expired" ? MSG.expired : MSG.notPending
        )
      if (row.expiresAt <= now) {
        await repo.markExpired(row.id, tx) // commits: we return, not throw
        return failure(Err.ORGANIZATION_INVITATION_EXPIRED, MSG.expired)
      }

      const org = await repo.findOrganization(row.orgId, tx)
      if (!org || org.deletedAt || org.status !== "active")
        return failure(
          Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
          MSG.orgUnavailable
        )

      // Offboarded members come back through their old row (history stays intact).
      const existing = await members.findByOrgAndUser(row.orgId, userId, tx)
      if (existing?.isActive)
        return failure(
          Err.ORGANIZATION_INVITATION_ALREADY_MEMBER,
          "You are already a member"
        )

      const max = await limits.getMax(row.orgId, "managedUsers")
      if (
        max !== null &&
        (await members.countActiveByType(row.orgId, "managed", tx)) >= max
      )
        return failure(
          Err.ORGANIZATION_INVITATION_LIMIT_REACHED,
          "The user limit has been reached"
        )

      const username = await resolveMemberUsername(
        row.orgId,
        row.identifier,
        existing?.username,
        tx
      )

      // A unique violation aborts the PG transaction, so these failures roll everything back.
      const written = existing
        ? await members.reactivate(row.orgId, existing.id, username, tx)
        : await members.insert(
            { orgId: row.orgId, userId, type: "managed", username, isActive: true },
            tx
          )
      if (!written.ok)
        return failure(
          written.reason === "username_taken"
            ? Err.ORGANIZATION_INVITATION_USERNAME_TAKEN
            : Err.ORGANIZATION_INVITATION_ALREADY_MEMBER,
          written.reason === "username_taken"
            ? "This username is already used in the organization"
            : "You are already a member"
        )

      // Assign role if specified on invitation
      if (row.roleId && rolesRepo) {
        await rolesRepo.applyMemberRoles(
          {
            orgId: row.orgId,
            orgUserId: written.row.id,
            add: [row.roleId],
            remove: [],
            assignedByUserId: row.invitedBy,
          },
          tx
        )
      }

      const accepted = await repo.markAccepted(
        row.id,
        { acceptedOrgUserId: written.row.id, inviteeUserId: userId, now },
        tx
      )
      if (!accepted) throw new Error("Invitation changed while locked") // rolls back the member write
      await repo.revokeOtherPending(
        row.orgId,
        row.id,
        { inviteeUserId: userId, identifier: row.identifier },
        now,
        tx
      )
      return { member: written.row, invitationId: row.id }
    })
    if (isFailure(outcome)) return toFail(outcome)

    const { member, invitationId } = outcome
    await activityLog.log({
      action: ORG_INVITATION_AUDIT_EVENTS.ACCEPTED,
      actorId: userId,
      orgId: member.orgId,
      resource: "organization_invitation",
      resourceId: invitationId,
    })
    await activityLog.log({
      action: ORG_USER_AUDIT_EVENTS.JOINED,
      actorId: userId,
      orgId: member.orgId,
      resource: "organization_user",
      resourceId: member.id,
    })
    return ok({ data: toOrganizationUserDto(member), msg: "You joined the organization" })
  }

  return {
    /* ------------------------------ manager side ------------------------------ */

    async create(
      actorId: string,
      orgId: string,
      input: CreateOrganizationInvitationInput
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      if (!(await can(actorId, PERM.create, orgId)))
        return fail({ error: Err.ORGANIZATION_INVITATION_FORBIDDEN, msg: MSG.forbidden })

      const identifier = input.identifier.trim().toLowerCase()

      if (input.roleId && rolesRepo) {
        const visibleRole = await rolesRepo.findVisibleById(orgId, input.roleId)
        if (!visibleRole)
          return fail({
            error: Err.ORGANIZATION_INVITATION_ROLE_NOT_FOUND,
            msg: "The specified role was not found",
          })
      }

      // Resolve the invitee BEFORE the transaction: external reads must not hold the lock.
      const found = await users.findVerifiedByContact({ identifier, email: identifier })
      const inviteeUserId = found?.userId ?? null

      const now = clock()
      const issued = tokens.generate()

      const outcome = await repo.transaction(async (tx) => {
        await members.lockOrgMembership(orgId, tx)

        const org = await repo.findOrganization(orgId, tx)
        if (!org || org.deletedAt || org.status !== "active")
          return failure(
            Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
            MSG.orgUnavailable
          )

        const inviter = await members.findByOrgAndUser(orgId, actorId, tx)
        if (!inviter || !inviter.isActive)
          return failure(Err.ORGANIZATION_INVITATION_FORBIDDEN, MSG.forbidden)

        if (inviteeUserId) {
          const existing = await members.findByOrgAndUser(orgId, inviteeUserId, tx)
          if (existing?.isActive)
            return failure(
              Err.ORGANIZATION_INVITATION_ALREADY_MEMBER,
              "This person is already a member"
            )
        }

        // Plan limit: active members + open invitations.
        const max = await limits.getMax(orgId, "managedUsers")
        if (max !== null) {
          const active = await members.countActiveByType(orgId, "managed", tx)
          const pending = await repo.countPending(orgId, now, tx)
          if (active + pending >= max)
            return failure(
              Err.ORGANIZATION_INVITATION_LIMIT_REACHED,
              "The user limit has been reached"
            )
        }

        await repo.expireStaleForTarget(orgId, { identifier, inviteeUserId }, now, tx)

        const res = await repo.insert(
          {
            orgId,
            identifier,
            roleId: input.roleId ?? null,
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
        if (!res.ok)
          return failure(
            Err.ORGANIZATION_INVITATION_ALREADY_PENDING,
            "There is already a pending invitation for this person"
          )
        return { row: res.row, org }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.CREATED,
        actorId,
        orgId,
        resource: "organization_invitation",
        resourceId: outcome.row.id,
        metadata: { identifier: outcome.row.identifier, roleId: outcome.row.roleId },
      })
      const delivered = await deliver(deliveryOf(outcome.row, outcome.org, issued.token))
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
      if (!(await can(actorId, PERM.read, orgId)))
        return fail({ error: Err.ORGANIZATION_INVITATION_FORBIDDEN, msg: MSG.forbidden })
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
      if (!(await can(actorId, PERM.update, orgId)))
        return fail({ error: Err.ORGANIZATION_INVITATION_FORBIDDEN, msg: MSG.forbidden })
      const now = clock()

      const outcome = await repo.transaction(async (tx) => {
        await members.lockOrgMembership(orgId, tx)
        const row = await repo.findInOrg(orgId, invitationId, tx)
        if (!row) return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)
        if (row.status !== "pending")
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        const revoked = await repo.markRevoked(row.id, now, tx)
        if (!revoked)
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        return revoked
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.REVOKED,
        actorId,
        orgId,
        resource: "organization_invitation",
        resourceId: outcome.id,
      })
      return ok({
        data: toOrganizationInvitationDto(outcome, now),
        msg: "Invitation revoked",
      })
    },

    async resend(
      actorId: string,
      orgId: string,
      invitationId: string
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      if (!(await can(actorId, PERM.update, orgId)))
        return fail({ error: Err.ORGANIZATION_INVITATION_FORBIDDEN, msg: MSG.forbidden })
      const now = clock()
      const issued = tokens.generate()

      const outcome = await repo.transaction(async (tx) => {
        await members.lockOrgMembership(orgId, tx)
        const row = await repo.findInOrg(orgId, invitationId, tx)
        if (!row) return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)
        if (row.status !== "pending")
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        if (row.expiresAt <= now) {
          await repo.markExpired(row.id, tx) // commits: we return, not throw
          return failure(Err.ORGANIZATION_INVITATION_EXPIRED, MSG.expired)
        }
        if (row.sendCount >= MAX_SEND_COUNT)
          return failure(
            Err.ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED,
            "This invitation was resent too many times"
          )
        if (now.getTime() - row.lastSentAt.getTime() < RESEND_COOLDOWN_MS)
          return failure(
            Err.ORGANIZATION_INVITATION_RESEND_TOO_SOON,
            "Please wait before resending this invitation"
          )
        const org = await repo.findOrganization(orgId, tx)
        if (!org || org.deletedAt || org.status !== "active")
          return failure(
            Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
            MSG.orgUnavailable
          )

        const rotated = await repo.rotateToken(
          row.id,
          {
            tokenHash: issued.hash,
            expiresAt: addDays(now, INVITATION_TTL_DAYS),
            now,
          },
          tx
        )
        if (!rotated)
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        return { row: rotated, org }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.RESENT,
        actorId,
        orgId,
        resource: "organization_invitation",
        resourceId: outcome.row.id,
        metadata: { identifier: outcome.row.identifier },
      })
      const delivered = await deliver(deliveryOf(outcome.row, outcome.org, issued.token))
      return ok({
        data: toOrganizationInvitationDto(outcome.row, now),
        msg: delivered ? "Invitation resent" : "Delivery failed. Try again shortly",
      })
    },

    /* ------------------------------ invitee side ------------------------------ */

    /** Public: what the sign-up / accept page shows for a link. */
    async preview(token: string): Promise<Result<InvitationPreviewDto, Code>> {
      const found = await repo.findPreviewByTokenHash(tokens.hash(token))
      if (!found)
        return fail({ error: Err.ORGANIZATION_INVITATION_NOT_FOUND, msg: MSG.notFound })
      const { invitation, org } = found
      if (invitation.status !== "pending")
        return fail({
          error:
            invitation.status === "expired"
              ? Err.ORGANIZATION_INVITATION_EXPIRED
              : Err.ORGANIZATION_INVITATION_NOT_PENDING,
          msg: invitation.status === "expired" ? MSG.expired : MSG.notPending,
        })
      if (invitation.expiresAt <= clock())
        return fail({ error: Err.ORGANIZATION_INVITATION_EXPIRED, msg: MSG.expired })
      if (org.deletedAt || org.status !== "active")
        return fail({
          error: Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
          msg: MSG.orgUnavailable
        })
      return ok({
        data: toInvitationPreviewDto(invitation, org),
        msg: "Invitation retrieved successfully",
      })
    },

    async listMine(userId: string): Promise<Result<{ items: MyInvitationDto[] }, Code>> {
      const rows = await repo.listPendingForUser(userId, clock())
      return ok({
        data: {
          items: rows.map(({ invitation, org }) => toMyInvitationDto(invitation, org)),
        },
        msg: "Invitations retrieved successfully",
      })
    },

    /** Accept from the dashboard inbox (invitation addressed to this user). */
    acceptMine(userId: string, invitationId: string, _input?: AcceptMyInvitationInput) {
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
      const outcome = await repo.transaction(async (tx) => {
        const row = await lockedInvitation(tx, () =>
          repo.findForInvitee(invitationId, userId, tx)
        )
        if (!row) return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)
        if (row.status !== "pending")
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        if (row.expiresAt <= now) {
          await repo.markExpired(row.id, tx)
          return failure(Err.ORGANIZATION_INVITATION_EXPIRED, MSG.expired)
        }
        const declined = await repo.markDeclined(row.id, now, tx)
        if (!declined)
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        return declined
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ORG_INVITATION_AUDIT_EVENTS.DECLINED,
        actorId: userId,
        orgId: outcome.orgId,
        resource: "organization_invitation",
        resourceId: outcome.id,
      })
      return ok({ data: toOrganizationInvitationDto(outcome, now), msg: "Invitation declined" })
    },

    /* ------------------------------ system hooks ------------------------------ */

    /**
     * Call from the auth module right after an email / phone is VERIFIED. Attaches open
     * invitations for that contact to the user so they appear in the inbox.
     * At most one invitation per organization is linked (unique pending-per-user index).
     */
    async linkPendingInvitations(
      userId: string,
      contact: { identifier?: string | null; email?: string | null; phone?: string | null }
    ): Promise<number> {
      const now = clock()
      const identifier = contact.identifier ?? contact.email ?? contact.phone
      const candidates = await repo.findLinkCandidates({ identifier }, now)
      if (!candidates.length) return 0
      const alreadyLinkedOrgs = new Set(await repo.listPendingOrgIdsForUser(userId, now))
      const ids: string[] = []
      for (const c of candidates) {
        // candidates are newest first: keep the newest per org
        if (alreadyLinkedOrgs.has(c.orgId)) continue
        alreadyLinkedOrgs.add(c.orgId)
        ids.push(c.id)
      }
      return repo.linkInvitee(ids, userId)
    },

    /** Cron entry point; keeps statuses honest because the unique indexes only see 'pending'. */
    expireDueInvitations(): Promise<number> {
      return repo.expireAllDue(clock())
    },
  }
}

export type OrganizationInvitationService = ReturnType<
  typeof createOrganizationInvitationService
>

// ---------------------------------------------------------------------------
// Module-level singleton – wired by organization.composition.ts in production.
// The lazy pattern means the real deps are resolved at first use, not at import
// time, so tests that import individual route handlers still work without a DB.
// ---------------------------------------------------------------------------
import { db } from "../../db.js"
import { createOrganizationUserRepository } from "../organization-user/organization-user.repository.js"
import { createRoleRepository } from "../role/role.repository.js"
import { DummyActivityLog } from "../activity-log/testing.js"
import { DummyLimits } from "../organization-user/organization-user.service.js"
import { DummyUserDirectory, DummyInvitationNotifier } from "./testing.js"
import { PermissionChecker as RealPermissionChecker } from "../role/permission-checker/permission-checker.query.js"
import { createOrganizationInvitationRepository } from "./organization-invitation.repository.js"

let _singleton: OrganizationInvitationService | undefined

export function getOrganizationInvitationService(): OrganizationInvitationService {
  if (!_singleton) {
    _singleton = createOrganizationInvitationService({
      repository: createOrganizationInvitationRepository({ db }),
      members: createOrganizationUserRepository({ db }),
      roles: createRoleRepository({ db }),
      permissions: new RealPermissionChecker(db),
      activityLog: new DummyActivityLog(), // TODO: wire real ActivityLogService
      limits: new DummyLimits(),
      users: new DummyUserDirectory(),
      notifier: new DummyInvitationNotifier(),
    })
  }
  return _singleton
}

/** @deprecated Use getOrganizationInvitationService() or inject via createOrganizationModules. */
export const organizationInvitationService = new Proxy({} as OrganizationInvitationService, {
  get(_target, prop) {
    return (getOrganizationInvitationService() as any)[prop]
  },
})
