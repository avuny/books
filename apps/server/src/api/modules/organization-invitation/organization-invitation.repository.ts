import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import {
  organizationInvitations as inv,
  organizations,
  type DB,
  type InvitationStatus,
  type NewOrganizationInvitation,
  type OrganizationInvitation,
  type OrgMemberType,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { OrganizationSummary } from "../organization-user/index.js"

const PENDING_UNIQUE_INDEXES = [
  "ux_org_invitation_pending_email",
  "ux_org_invitation_pending_phone",
  "ux_org_invitation_pending_user",
] as const

export type InvitationWithOrganization = {
  invitation: OrganizationInvitation
  org: OrganizationSummary
}

export type ListInvitationsFilter = {
  status?: InvitationStatus
  type?: "managed" | "portal"
  page: number
  pageSize: number
}

export type InvitationTarget = {
  email?: string | null
  phone?: string | null
  inviteeUserId?: string | null
}

const orgColumns = {
  id: organizations.id,
  code: organizations.code,
  name: organizations.name,
  status: organizations.status,
  deletedAt: organizations.deletedAt,
}

/** Targets that identify "the same person" for the partial unique indexes. */
function targetCondition(t: InvitationTarget): SQL | undefined {
  const parts: SQL[] = []
  if (t.email) parts.push(eq(inv.email, t.email))
  if (t.phone) parts.push(eq(inv.phone, t.phone))
  if (t.inviteeUserId) parts.push(eq(inv.inviteeUserId, t.inviteeUserId))
  return parts.length ? or(...parts) : undefined
}

/**
 * Pure Drizzle access for `organization_invitations`.
 * Callers hold the per-organization advisory lock (see organization-user repository)
 * for every mutation, so no row locks are needed here.
 */
export function createOrganizationInvitationRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    async findOrganization(orgId: string, tx?: Tx): Promise<OrganizationSummary | null> {
      const [row] = await exec(tx)
        .select(orgColumns)
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1)
      return row ?? null
    },

    async findInOrg(
      orgId: string,
      id: string,
      tx?: Tx
    ): Promise<OrganizationInvitation | null> {
      const [row] = await exec(tx)
        .select()
        .from(inv)
        .where(and(eq(inv.orgId, orgId), eq(inv.id, id)))
        .limit(1)
      return row ?? null
    },

    /** Invitee-side lookup: only invitations addressed to this user. */
    async findForInvitee(
      id: string,
      userId: string,
      tx?: Tx
    ): Promise<OrganizationInvitation | null> {
      const [row] = await exec(tx)
        .select()
        .from(inv)
        .where(and(eq(inv.id, id), eq(inv.inviteeUserId, userId)))
        .limit(1)
      return row ?? null
    },

    async findByTokenHash(
      tokenHash: string,
      tx?: Tx
    ): Promise<OrganizationInvitation | null> {
      const [row] = await exec(tx)
        .select()
        .from(inv)
        .where(eq(inv.tokenHash, tokenHash))
        .limit(1)
      return row ?? null
    },

    async findPreviewByTokenHash(
      tokenHash: string,
      tx?: Tx
    ): Promise<InvitationWithOrganization | null> {
      const [row] = await exec(tx)
        .select({ invitation: inv, org: orgColumns })
        .from(inv)
        .innerJoin(organizations, eq(organizations.id, inv.orgId))
        .where(eq(inv.tokenHash, tokenHash))
        .limit(1)
      return row ?? null
    },

    async list(
      orgId: string,
      f: ListInvitationsFilter,
      now: Date,
      tx?: Tx
    ): Promise<{ rows: OrganizationInvitation[]; total: number }> {
      const conditions: SQL[] = [eq(inv.orgId, orgId)]
      if (f.type) conditions.push(eq(inv.type, f.type))
      if (f.status === "pending")
        conditions.push(eq(inv.status, "pending"), gt(inv.expiresAt, now))
      else if (f.status === "expired")
        conditions.push(
          or(
            eq(inv.status, "expired"),
            and(eq(inv.status, "pending"), lte(inv.expiresAt, now))
          )!
        )
      else if (f.status) conditions.push(eq(inv.status, f.status))
      const where = and(...conditions)

      const rows = await exec(tx)
        .select()
        .from(inv)
        .where(where)
        .orderBy(desc(inv.createdAt), desc(inv.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: count() })
        .from(inv)
        .where(where)
      return { rows, total: Number(counted?.total ?? 0) }
    },

    /** The invitee's inbox: open invitations addressed to this user. */
    async listPendingForUser(
      userId: string,
      now: Date,
      tx?: Tx
    ): Promise<InvitationWithOrganization[]> {
      return exec(tx)
        .select({ invitation: inv, org: orgColumns })
        .from(inv)
        .innerJoin(organizations, eq(organizations.id, inv.orgId))
        .where(
          and(
            eq(inv.inviteeUserId, userId),
            eq(inv.status, "pending"),
            gt(inv.expiresAt, now),
            eq(organizations.status, "active"),
            isNull(organizations.deletedAt)
          )
        )
        .orderBy(desc(inv.createdAt))
        .limit(100)
    },

    async countPending(
      orgId: string,
      type: OrgMemberType,
      now: Date,
      tx?: Tx
    ): Promise<number> {
      const [row] = await exec(tx)
        .select({ total: count() })
        .from(inv)
        .where(
          and(
            eq(inv.orgId, orgId),
            eq(inv.type, type),
            eq(inv.status, "pending"),
            gt(inv.expiresAt, now)
          )
        )
      return Number(row?.total ?? 0)
    },

    /**
     * Flips lapsed pending invites for the same target to 'expired' so the partial
     * unique indexes (status = 'pending') do not block a fresh invite.
     */
    async expireStaleForTarget(
      orgId: string,
      target: InvitationTarget,
      now: Date,
      tx?: Tx
    ): Promise<number> {
      const targetSql = targetCondition(target)
      if (!targetSql) return 0
      const rows = await exec(tx)
        .update(inv)
        .set({ status: "expired" })
        .where(
          and(
            eq(inv.orgId, orgId),
            eq(inv.status, "pending"),
            lte(inv.expiresAt, now),
            targetSql
          )
        )
        .returning({ id: inv.id })
      return rows.length
    },

    /** Job entry point: flips every lapsed pending invite. */
    async expireAllDue(now: Date): Promise<number> {
      const rows = await db
        .update(inv)
        .set({ status: "expired" })
        .where(and(eq(inv.status, "pending"), lte(inv.expiresAt, now)))
        .returning({ id: inv.id })
      return rows.length
    },

    async insert(
      values: NewOrganizationInvitation,
      tx?: Tx
    ): Promise<
      { ok: true; row: OrganizationInvitation } | { ok: false; reason: "already_pending" }
    > {
      try {
        const [row] = await exec(tx).insert(inv).values(values).returning()
        if (!row) throw new Error("insert returned no row")
        return { ok: true, row }
      } catch (err) {
        if (isUniqueViolation(err, PENDING_UNIQUE_INDEXES))
          return { ok: false, reason: "already_pending" }
        throw err
      }
    },

    async markExpired(id: string, tx?: Tx): Promise<void> {
      await exec(tx)
        .update(inv)
        .set({ status: "expired" })
        .where(and(eq(inv.id, id), eq(inv.status, "pending")))
    },

    async markRevoked(id: string, now: Date, tx?: Tx) {
      const [row] = await exec(tx)
        .update(inv)
        .set({ status: "revoked", respondedAt: now })
        .where(and(eq(inv.id, id), eq(inv.status, "pending")))
        .returning()
      return row ?? null
    },

    async markDeclined(id: string, now: Date, tx?: Tx) {
      const [row] = await exec(tx)
        .update(inv)
        .set({ status: "declined", respondedAt: now })
        .where(and(eq(inv.id, id), eq(inv.status, "pending")))
        .returning()
      return row ?? null
    },

    /** ck_org_invitation_accepted_link: status 'accepted' <=> accepted_org_user_id is set. */
    async markAccepted(
      id: string,
      p: { acceptedOrgUserId: string; inviteeUserId: string; now: Date },
      tx?: Tx
    ) {
      const [row] = await exec(tx)
        .update(inv)
        .set({
          status: "accepted",
          acceptedOrgUserId: p.acceptedOrgUserId,
          inviteeUserId: p.inviteeUserId,
          respondedAt: p.now,
        })
        .where(and(eq(inv.id, id), eq(inv.status, "pending")))
        .returning()
      return row ?? null
    },

    /** Resend rotates the token (only the hash is stored) and restarts the expiry window. */
    async rotateToken(
      id: string,
      p: { tokenHash: string; expiresAt: Date; now: Date },
      tx?: Tx
    ) {
      const [row] = await exec(tx)
        .update(inv)
        .set({
          tokenHash: p.tokenHash,
          expiresAt: p.expiresAt,
          lastSentAt: p.now,
          sendCount: sql`${inv.sendCount} + 1`,
        })
        .where(and(eq(inv.id, id), eq(inv.status, "pending")))
        .returning()
      return row ?? null
    },

    /** After an accept: other open invites for the same person in the same org are moot. */
    async revokeOtherPending(
      orgId: string,
      exceptId: string,
      target: InvitationTarget,
      now: Date,
      tx?: Tx
    ): Promise<number> {
      const targetSql = targetCondition(target)
      if (!targetSql) return 0
      const rows = await exec(tx)
        .update(inv)
        .set({ status: "revoked", respondedAt: now })
        .where(
          and(
            eq(inv.orgId, orgId),
            eq(inv.status, "pending"),
            ne(inv.id, exceptId),
            targetSql
          )
        )
        .returning({ id: inv.id })
      return rows.length
    },

    /* ----- sign-up auto-link ----- */

    async findLinkCandidates(
      contact: { email?: string | null; phone?: string | null },
      now: Date,
      tx?: Tx
    ): Promise<OrganizationInvitation[]> {
      const byContact = targetCondition(contact)
      if (!byContact) return []
      return exec(tx)
        .select()
        .from(inv)
        .where(
          and(
            eq(inv.status, "pending"),
            gt(inv.expiresAt, now),
            isNull(inv.inviteeUserId),
            byContact
          )
        )
        .orderBy(desc(inv.createdAt))
    },

    async listPendingOrgIdsForUser(userId: string, now: Date, tx?: Tx): Promise<string[]> {
      const rows = await exec(tx)
        .select({ orgId: inv.orgId })
        .from(inv)
        .where(
          and(eq(inv.inviteeUserId, userId), eq(inv.status, "pending"), gt(inv.expiresAt, now))
        )
      return rows.map((r) => r.orgId)
    },

    async linkInvitee(ids: string[], userId: string, tx?: Tx): Promise<number> {
      if (!ids.length) return 0
      const rows = await exec(tx)
        .update(inv)
        .set({ inviteeUserId: userId })
        .where(
          and(inArray(inv.id, ids), eq(inv.status, "pending"), isNull(inv.inviteeUserId))
        )
        .returning({ id: inv.id })
      return rows.length
    },
  }
}

export type OrganizationInvitationRepository = ReturnType<
  typeof createOrganizationInvitationRepository
>
