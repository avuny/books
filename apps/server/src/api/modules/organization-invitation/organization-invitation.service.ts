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
} from "@avuny/contracts"
import type { OrganizationInvitation, Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { db } from "../../db.js"
import {
  createOrganizationUserRepository,
  DummyActivityLog,
  DummyLimits,
  DummyPermissionChecker,
  limitResourceFor,
  toOrganizationUserDto,
  type ActivityLog,
  type Limits,
  type OrganizationUserRepository,
  type PermissionChecker,
} from "../organization-user/index.js"
import {
  OrganizationInvitationErrorCode,
  type OrganizationInvitationErrorCode as Code,
} from "./organization-invitation.errors.js"
import {
  toInvitationPreviewDto,
  toMyInvitationDto,
  toOrganizationInvitationDto,
} from "./organization-invitation.mapper.js"
import {
  createOrganizationInvitationRepository,
  type OrganizationInvitationRepository,
} from "./organization-invitation.repository.js"

const Err = OrganizationInvitationErrorCode

/* ---------- policy ---------- */

export const INVITATION_TTL_DAYS = 7
export const RESEND_COOLDOWN_MS = 60_000
export const MAX_SEND_COUNT = 5

/* ---------- ports ---------- */

/** Reads of the users table owned by the auth module. Contacts MUST be verified ones. */
export interface UserDirectory {
  /** Verified user matching the email (checked first) or the phone; null if none. */
  findVerifiedByContact(c: {
    email?: string | null
    phone?: string | null
  }): Promise<{ userId: string } | null>
  /** Verified contact details of a user; null when the user does not exist. */
  getVerifiedContact(
    userId: string
  ): Promise<{ email: string | null; phone: string | null } | null>
}

export interface InvitationDelivery {
  invitation: {
    id: string
    type: "managed" | "portal"
    channel: "email" | "whatsapp"
    email: string | null
    phone: string | null
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

export class DummyUserDirectory implements UserDirectory {
  async findVerifiedByContact(): Promise<null> {
    return null
  }
  async getVerifiedContact(): Promise<null> {
    return null
  }
}
export class DummyInvitationNotifier implements InvitationNotifier {
  async send(): Promise<void> {}
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
  permissions?: PermissionChecker
  activityLog?: ActivityLog
  limits?: Limits
  users?: UserDirectory
  notifier?: InvitationNotifier
  tokens?: TokenGenerator
  now?: () => Date
}

export function createOrganizationInvitationService(
  deps: OrganizationInvitationServiceDeps
) {
  const repo = deps.repository
  const members = deps.members
  const permissions = deps.permissions ?? new DummyPermissionChecker()
  const activityLog = deps.activityLog ?? new DummyActivityLog()
  const limits = deps.limits ?? new DummyLimits()
  const users = deps.users ?? new DummyUserDirectory()
  const notifier = deps.notifier ?? new DummyInvitationNotifier()
  const tokens = deps.tokens ?? new CryptoTokenGenerator()
  const clock = deps.now ?? (() => new Date())

  const can = (actorId: string, action: string, orgId: string) =>
    permissions.check({ userId: actorId }, action, { resourceId: orgId })

  /** Delivery must never roll back a committed invitation; the caller can resend. */
  async function deliver(d: InvitationDelivery): Promise<boolean> {
    try {
      await notifier.send(d)
      return true
    } catch {
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
      type: row.type as "managed" | "portal",
      channel: row.channel,
      email: row.email,
      phone: row.phone,
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

  /* ---------- accept (shared by id / token) ---------- */

  async function accept(
    userId: string,
    ref: AcceptRef,
    input: { username?: string }
  ): Promise<Result<OrganizationUserDto, Code>> {
    const now = clock()
    const tokenHash = ref.kind === "token" ? tokens.hash(ref.token) : null
    // External read outside the transaction: the user's VERIFIED contacts.
    const contact = ref.kind === "token" ? await users.getVerifiedContact(userId) : null

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
        const matches =
          row.channel === "email"
            ? !!row.email && contact?.email === row.email
            : !!row.phone && contact?.phone === row.phone
        if (!matches)
          return failure(
            Err.ORGANIZATION_INVITATION_IDENTITY_MISMATCH,
            "This invitation was sent to a different verified contact"
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
        return failure(Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE, MSG.orgUnavailable)

      // Offboarded members come back through their old row (history stays intact).
      const existing = await members.findByOrgAndUser(row.orgId, userId, tx)
      if (existing?.isActive)
        return failure(Err.ORGANIZATION_INVITATION_ALREADY_MEMBER, "You are already a member")
      if (existing && existing.type !== row.type)
        return failure(
          Err.ORGANIZATION_INVITATION_MEMBER_TYPE_CONFLICT,
          "You already have a different membership type here"
        )

      const resource = limitResourceFor(row.type)
      const max = resource ? await limits.getMax(row.orgId, resource) : null
      if (max !== null && (await members.countActiveByType(row.orgId, row.type, tx)) >= max)
        return failure(
          Err.ORGANIZATION_INVITATION_LIMIT_REACHED,
          "The user limit for this member type has been reached"
        )

      const username = input.username ?? row.username ?? existing?.username
      if (!username)
        return failure(Err.ORGANIZATION_INVITATION_USERNAME_REQUIRED, "A username is required to join")
      const holder = await members.findByUsername(row.orgId, username, tx)
      if (holder && holder.id !== existing?.id)
        return failure(
          Err.ORGANIZATION_INVITATION_USERNAME_TAKEN,
          "This username is already used in the organization"
        )

      // A unique violation aborts the PG transaction, so these failures roll everything back.
      const written = existing
        ? await members.reactivate(row.orgId, existing.id, username, tx)
        : await members.insert(
            { orgId: row.orgId, userId, type: row.type, username, isActive: true },
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

      const accepted = await repo.markAccepted(
        row.id,
        { acceptedOrgUserId: written.row.id, inviteeUserId: userId, now },
        tx
      )
      if (!accepted) throw new Error("Invitation changed while locked") // rolls back the member write
      await repo.revokeOtherPending(
        row.orgId,
        row.id,
        { inviteeUserId: userId, email: row.email, phone: row.phone },
        now,
        tx
      )
      return { member: written.row, invitationId: row.id }
    })
    if (isFailure(outcome)) return toFail(outcome)

    const { member, invitationId } = outcome
    await activityLog.log({
      type: ORG_INVITATION_AUDIT_EVENTS.ACCEPTED,
      actorId: userId,
      orgId: member.orgId,
      entityId: invitationId,
    })
    await activityLog.log({
      type: ORG_USER_AUDIT_EVENTS.JOINED,
      actorId: userId,
      orgId: member.orgId,
      entityId: member.id,
      metadata: { type: member.type },
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
      if (!(await can(actorId, "create:organization-invitation", orgId)))
        return fail({ error: Err.ORGANIZATION_INVITATION_FORBIDDEN, msg: MSG.forbidden })
      if (!(await limits.isChannelAllowed(orgId, input.channel)))
        return fail({
          error: Err.ORGANIZATION_INVITATION_CHANNEL_NOT_ALLOWED,
          msg: "This invitation channel is not available on your plan",
        })

      // Resolve the invitee BEFORE the transaction: external reads must not hold the lock.
      let { email, phone, inviteeUserId } = input
      if (inviteeUserId) {
        const contact = await users.getVerifiedContact(inviteeUserId)
        if (!contact)
          return fail({
            error: Err.ORGANIZATION_INVITATION_TARGET_UNAVAILABLE,
            msg: "No usable contact was found for this invitee",
          })
        email ??= contact.email ?? undefined
        phone ??= contact.phone ?? undefined
      } else {
        const found = await users.findVerifiedByContact({ email, phone })
        inviteeUserId = found?.userId
      }
      if ((input.channel === "email" && !email) || (input.channel === "whatsapp" && !phone))
        return fail({
          error: Err.ORGANIZATION_INVITATION_TARGET_UNAVAILABLE,
          msg: "No usable contact was found for this invitee",
        })

      const now = clock()
      const issued = tokens.generate()

      const outcome = await repo.transaction(async (tx) => {
        await members.lockOrgMembership(orgId, tx)

        const org = await repo.findOrganization(orgId, tx)
        if (!org || org.deletedAt || org.status !== "active")
          return failure(Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE, MSG.orgUnavailable)

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
          if (existing && existing.type !== input.type)
            return failure(
              Err.ORGANIZATION_INVITATION_MEMBER_TYPE_CONFLICT,
              "This person already has a different membership type here"
            )
        }

        if (input.username && (await members.findByUsername(orgId, input.username, tx)))
          return failure(
            Err.ORGANIZATION_INVITATION_USERNAME_TAKEN,
            "This username is already used in the organization"
          )

        // Plan limit: active members + open invitations of the same type.
        const resource = limitResourceFor(input.type)
        const max = resource ? await limits.getMax(orgId, resource) : null
        if (max !== null) {
          const active = await members.countActiveByType(orgId, input.type, tx)
          const pending = await repo.countPending(orgId, input.type, now, tx)
          if (active + pending >= max)
            return failure(
              Err.ORGANIZATION_INVITATION_LIMIT_REACHED,
              "The user limit for this member type has been reached"
            )
        }

        await repo.expireStaleForTarget(orgId, { email, phone, inviteeUserId }, now, tx)

        const res = await repo.insert(
          {
            orgId,
            type: input.type,
            channel: input.channel,
            email: email ?? null,
            phone: phone ?? null,
            inviteeUserId: inviteeUserId ?? null,
            username: input.username ?? null,
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
        type: ORG_INVITATION_AUDIT_EVENTS.CREATED,
        actorId,
        orgId,
        entityId: outcome.row.id,
        metadata: { type: input.type, channel: input.channel },
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
      if (!(await can(actorId, "read:organization-invitation", orgId)))
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
      if (!(await can(actorId, "update:organization-invitation", orgId)))
        return fail({ error: Err.ORGANIZATION_INVITATION_FORBIDDEN, msg: MSG.forbidden })
      const now = clock()

      const outcome = await repo.transaction(async (tx) => {
        await members.lockOrgMembership(orgId, tx)
        const row = await repo.findInOrg(orgId, invitationId, tx)
        if (!row) return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)
        if (row.status !== "pending")
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        const revoked = await repo.markRevoked(row.id, now, tx)
        if (!revoked) return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        return revoked
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        type: ORG_INVITATION_AUDIT_EVENTS.REVOKED,
        actorId,
        orgId,
        entityId: invitationId,
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
      if (!(await can(actorId, "update:organization-invitation", orgId)))
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
          return failure(Err.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE, MSG.orgUnavailable)

        const rotated = await repo.rotateToken(
          row.id,
          {
            tokenHash: issued.hash,
            expiresAt: addDays(now, INVITATION_TTL_DAYS),
            now,
          },
          tx
        )
        if (!rotated) return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        return { row: rotated, org }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        type: ORG_INVITATION_AUDIT_EVENTS.RESENT,
        actorId,
        orgId,
        entityId: invitationId,
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
      if (!found) return fail({ error: Err.ORGANIZATION_INVITATION_NOT_FOUND, msg: MSG.notFound })
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
          msg: MSG.orgUnavailable,
        })
      return ok({
        data: toInvitationPreviewDto(invitation, org),
        msg: "Invitation retrieved successfully",
      })
    },

    async listMine(userId: string): Promise<Result<{ items: MyInvitationDto[] }, Code>> {
      const rows = await repo.listPendingForUser(userId, clock())
      return ok({
        data: { items: rows.map(({ invitation, org }) => toMyInvitationDto(invitation, org)) },
        msg: "Invitations retrieved successfully",
      })
    },

    /** Accept from the dashboard inbox (invitation addressed to this user). */
    acceptMine(userId: string, invitationId: string, input: AcceptMyInvitationInput) {
      return accept(userId, { kind: "id", id: invitationId }, input)
    },

    /** Accept from an emailed / WhatsApp link by a signed-in user. */
    acceptByToken(userId: string, input: AcceptInvitationByTokenInput) {
      return accept(userId, { kind: "token", token: input.token }, input)
    },

    async decline(
      userId: string,
      invitationId: string
    ): Promise<Result<OrganizationInvitationDto, Code>> {
      const now = clock()
      const outcome = await repo.transaction(async (tx) => {
        const row = await lockedInvitation(tx, () => repo.findForInvitee(invitationId, userId, tx))
        if (!row) return failure(Err.ORGANIZATION_INVITATION_NOT_FOUND, MSG.notFound)
        if (row.status !== "pending")
          return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        if (row.expiresAt <= now) {
          await repo.markExpired(row.id, tx)
          return failure(Err.ORGANIZATION_INVITATION_EXPIRED, MSG.expired)
        }
        const declined = await repo.markDeclined(row.id, now, tx)
        if (!declined) return failure(Err.ORGANIZATION_INVITATION_NOT_PENDING, MSG.notPending)
        return declined
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        type: ORG_INVITATION_AUDIT_EVENTS.DECLINED,
        actorId: userId,
        orgId: outcome.orgId,
        entityId: outcome.id,
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
      contact: { email?: string | null; phone?: string | null }
    ): Promise<number> {
      const now = clock()
      const candidates = await repo.findLinkCandidates(contact, now)
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

export function createDefaultOrganizationInvitationService(): OrganizationInvitationService {
  return createOrganizationInvitationService({
    repository: createOrganizationInvitationRepository({ db }),
    members: createOrganizationUserRepository({ db }),
  })
}

export const organizationInvitationService = createDefaultOrganizationInvitationService()
