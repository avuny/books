import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm"
import {
  organizationUsers,
  organizations,
  type DB,
  type NewOrganizationUser,
  type Organization,
  type OrganizationUser,
  type OrgMemberType,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"

// Index names from packages/db/src/schema/organization/organizations.ts
const UX_MEMBER = "ux_org_user_member"
const UX_USERNAME = "ux_org_user_username"

export type OrganizationUserWriteResult =
  | { ok: true; row: OrganizationUser }
  | { ok: false; reason: "username_taken" | "already_member" | "not_found" }

export type OrganizationSummary = Pick<
  Organization,
  "id" | "code" | "name" | "status" | "deletedAt"
>

export type MembershipWithOrganization = {
  membership: OrganizationUser
  org: OrganizationSummary
}

export type ListMembersFilter = {
  type?: OrgMemberType
  isActive?: boolean
  search?: string
  page: number
  pageSize: number
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

const orgSummaryColumns = {
  id: organizations.id,
  code: organizations.code,
  name: organizations.name,
  status: organizations.status,
  deletedAt: organizations.deletedAt,
}

/**
 * Pure Drizzle access for `organization_users`.
 * Every method takes an optional `tx` so services can compose them atomically.
 */
export function createOrganizationUserRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /**
     * Serializes every membership / invitation mutation of ONE organization
     * (limit checks, username checks, invite + accept). Released at commit/rollback.
     * Always take it FIRST inside a transaction so lock order stays consistent.
     */
    async lockOrgMembership(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`org_members:${orgId}`}, 0))`
      )
    },

    async findOrganization(
      orgId: string,
      tx?: Tx
    ): Promise<OrganizationSummary | null> {
      const [row] = await exec(tx)
        .select(orgSummaryColumns)
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1)
      return row ?? null
    },

    async findById(
      orgId: string,
      id: string,
      tx?: Tx
    ): Promise<OrganizationUser | null> {
      const [row] = await exec(tx)
        .select()
        .from(organizationUsers)
        .where(
          and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.id, id))
        )
        .limit(1)
      return row ?? null
    },

    async findByOrgAndUser(
      orgId: string,
      userId: string,
      tx?: Tx
    ): Promise<OrganizationUser | null> {
      const [row] = await exec(tx)
        .select()
        .from(organizationUsers)
        .where(
          and(
            eq(organizationUsers.orgId, orgId),
            eq(organizationUsers.userId, userId)
          )
        )
        .limit(1)
      return row ?? null
    },

    async findByUsername(
      orgId: string,
      username: string,
      tx?: Tx
    ): Promise<OrganizationUser | null> {
      const [row] = await exec(tx)
        .select()
        .from(organizationUsers)
        .where(
          and(
            eq(organizationUsers.orgId, orgId),
            eq(organizationUsers.username, username)
          )
        )
        .limit(1)
      return row ?? null
    },

    async list(
      orgId: string,
      f: ListMembersFilter,
      tx?: Tx
    ): Promise<{ rows: OrganizationUser[]; total: number }> {
      const conditions: SQL[] = [eq(organizationUsers.orgId, orgId)]
      if (f.type) conditions.push(eq(organizationUsers.type, f.type))
      if (f.isActive !== undefined)
        conditions.push(eq(organizationUsers.isActive, f.isActive))
      if (f.search)
        conditions.push(
          ilike(organizationUsers.username, `%${escapeLike(f.search)}%`)
        )
      const where = and(...conditions)

      const rows = await exec(tx)
        .select()
        .from(organizationUsers)
        .where(where)
        .orderBy(asc(organizationUsers.createdAt), asc(organizationUsers.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(organizationUsers)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    async countActiveByType(
      orgId: string,
      type: OrgMemberType,
      tx?: Tx
    ): Promise<number> {
      const [row] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(organizationUsers)
        .where(
          and(
            eq(organizationUsers.orgId, orgId),
            eq(organizationUsers.type, type),
            eq(organizationUsers.isActive, true)
          )
        )
      return row?.total ?? 0
    },

    /** The organization switcher: active memberships, most recently used first. */
    async listForUser(
      userId: string,
      tx?: Tx
    ): Promise<MembershipWithOrganization[]> {
      const rows = await exec(tx)
        .select({ membership: organizationUsers, org: orgSummaryColumns })
        .from(organizationUsers)
        .innerJoin(organizations, eq(organizations.id, organizationUsers.orgId))
        .where(
          and(
            eq(organizationUsers.userId, userId),
            eq(organizationUsers.isActive, true),
            sql`${organizations.deletedAt} is null`
          )
        )
        .orderBy(
          sql`${organizationUsers.lastAccessedAt} desc nulls last`,
          asc(organizationUsers.createdAt)
        )
      return rows
    },

    async insert(
      values: NewOrganizationUser,
      tx?: Tx
    ): Promise<OrganizationUserWriteResult> {
      try {
        const [row] = await exec(tx)
          .insert(organizationUsers)
          .values(values)
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, UX_USERNAME))
          return { ok: false, reason: "username_taken" }
        if (isUniqueViolation(err, UX_MEMBER))
          return { ok: false, reason: "already_member" }
        throw err
      }
    },

    async updateUsername(
      orgId: string,
      id: string,
      username: string,
      tx?: Tx
    ): Promise<OrganizationUserWriteResult> {
      try {
        const [row] = await exec(tx)
          .update(organizationUsers)
          .set({ username })
          .where(
            and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.id, id))
          )
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, UX_USERNAME))
          return { ok: false, reason: "username_taken" }
        throw err
      }
    },

    async setActive(
      orgId: string,
      id: string,
      isActive: boolean,
      tx?: Tx
    ): Promise<OrganizationUser | null> {
      const [row] = await exec(tx)
        .update(organizationUsers)
        .set({ isActive })
        .where(
          and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.id, id))
        )
        .returning()
      return row ?? null
    },

    /** Re-activates an offboarded member (history stays intact) and optionally renames. */
    async reactivate(
      orgId: string,
      id: string,
      username: string,
      tx?: Tx
    ): Promise<OrganizationUserWriteResult> {
      try {
        const [row] = await exec(tx)
          .update(organizationUsers)
          .set({ isActive: true, username })
          .where(
            and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.id, id))
          )
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, UX_USERNAME))
          return { ok: false, reason: "username_taken" }
        throw err
      }
    },

    async touch(
      orgId: string,
      id: string,
      at: Date,
      tx?: Tx
    ): Promise<void> {
      await exec(tx)
        .update(organizationUsers)
        .set({ lastAccessedAt: at })
        .where(
          and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.id, id))
        )
    },

    /**
     * Swaps owner -> managed and managed -> owner. `type` is immutable (trigger), so the
     * trigger must honor the transaction-local flag set here. Demote first: the partial
     * unique index `ux_org_one_owner` is checked per statement.
     * Returns the new owner row, or null if the target no longer qualifies (caller must
     * throw to roll back).
     */
    async transferOwnership(
      p: { orgId: string; fromId: string; toId: string },
      tx: Tx
    ): Promise<OrganizationUser | null> {
      await tx.execute(
        sql`select set_config('app.org_user_type_change', 'on', true)`
      )
      await tx
        .update(organizationUsers)
        .set({ type: "managed" })
        .where(
          and(
            eq(organizationUsers.orgId, p.orgId),
            eq(organizationUsers.id, p.fromId),
            eq(organizationUsers.type, "owner")
          )
        )
      const [row] = await tx
        .update(organizationUsers)
        .set({ type: "owner" })
        .where(
          and(
            eq(organizationUsers.orgId, p.orgId),
            eq(organizationUsers.id, p.toId),
            eq(organizationUsers.type, "managed"),
            eq(organizationUsers.isActive, true)
          )
        )
        .returning()
      return row ?? null
    },
  }
}

export type OrganizationUserRepository = ReturnType<
  typeof createOrganizationUserRepository
>
