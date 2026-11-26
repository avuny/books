import {
  and,
  asc,
  count as sqlCount,
  eq,
  getTableColumns,
  ilike,
  isNull,
  ne,
  sql,
} from "drizzle-orm"
// Adjust the import path to wherever your db package exports schema + types.
import {
  organizations,
  organizationUsers,
  type DB,
  type NewOrganization,
  type Organization,
  type OrgStatus,
  type Tx,
} from "@avuny/db"

/* ---------- types ---------- */

export type OrganizationCreateData = Pick<
  NewOrganization,
  "code" | "name" | "countryCode" | "stateId" | "defaultCurrency" | "timezone"
>

/** `code` is immutable (DB trigger), so it is not updatable here. */
export type OrganizationUpdateData = Partial<
  Pick<
    NewOrganization,
    "name" | "countryCode" | "stateId" | "defaultCurrency" | "timezone"
  >
>

/** An organization plus its owner (read from the 'owner' membership row). */
export type OrganizationWithOwner = Organization & { ownerId: string }

/** Lists are always "organizations this user is an active member of". */
export type OrganizationListFilter = {
  userId: string
  search?: string
  status?: OrgStatus
}

/* ---------- helpers ---------- */

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

/**
 * True when `err` is a Postgres unique violation (23505), optionally for one constraint.
 * Drizzle >= 0.44 wraps driver errors in `DrizzleQueryError`, so check `cause` first.
 */
export const isUniqueViolation = (err: unknown, constraint?: string): boolean => {
  const pg = ((err as { cause?: unknown } | null)?.cause ?? err) as {
    code?: string
    constraint?: string
  } | null
  return pg?.code === "23505" && (!constraint || pg.constraint === constraint)
}

/* ---------- repository ---------- */

export const createOrganizationRepository = ({ db }: { db: DB }) => {
  /** Run on the transaction when given, otherwise on the shared connection. */
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  const memberOf = (f: OrganizationListFilter) =>
    and(
      eq(organizationUsers.userId, f.userId),
      eq(organizationUsers.isActive, true),
      isNull(organizations.deletedAt),
      f.status ? eq(organizations.status, f.status) : undefined,
      f.search
        ? ilike(organizations.name, `%${escapeLike(f.search)}%`)
        : undefined
    )

  const ownedBy = (ownerId: string) =>
    and(
      eq(organizationUsers.userId, ownerId),
      eq(organizationUsers.type, "owner"),
      isNull(organizations.deletedAt)
    )

  return {
    /** Run several repository calls atomically. */
    transaction: <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
      db.transaction(fn),

    /**
     * Serialises "create / rename an organization" per owner until the transaction ends.
     * This is what makes the max-organizations check and the unique-name check race-safe
     * (neither can be expressed as a plain unique index with the current schema).
     * Must be called inside `transaction`.
     */
    async lockOwner(params: { ownerId: string; tx: Tx }): Promise<void> {
      await params.tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`org-owner:${params.ownerId}`}, 0))`
      )
    },

    /** Organization + its 'owner' membership, together (same transaction). */
    async createWithOwner(params: {
      data: OrganizationCreateData
      ownerId: string
      ownerUsername: string
      tx?: Tx
    }): Promise<Organization> {
      const { data, ownerId, ownerUsername, tx } = params
      const [org] = await exec(tx).insert(organizations).values(data).returning()
      await exec(tx).insert(organizationUsers).values({
        orgId: org!.id,
        userId: ownerId,
        type: "owner",
        username: ownerUsername,
      })
      return org!
    },

    /** Not-deleted organization by id, with its owner id. */
    async findById(params: {
      id: string
      tx?: Tx
    }): Promise<OrganizationWithOwner | null> {
      const [row] = await exec(params.tx)
        .select({
          organization: organizations,
          ownerId: organizationUsers.userId,
        })
        .from(organizations)
        .innerJoin(
          organizationUsers,
          and(
            eq(organizationUsers.orgId, organizations.id),
            eq(organizationUsers.type, "owner")
          )
        )
        .where(and(eq(organizations.id, params.id), isNull(organizations.deletedAt)))
        .limit(1)
      return row ? { ...row.organization, ownerId: row.ownerId } : null
    },

    async update(params: {
      id: string
      data: OrganizationUpdateData
      tx?: Tx
    }): Promise<Organization | null> {
      const [row] = await exec(params.tx)
        .update(organizations)
        .set({ ...params.data, updatedAt: new Date() }) // drop updatedAt if timestamps() uses $onUpdate
        .where(and(eq(organizations.id, params.id), isNull(organizations.deletedAt)))
        .returning()
      return row ?? null
    },

    /** Soft delete: status 'closed' + deleted_at. The code stays reserved. */
    async softDelete(params: { id: string; tx?: Tx }): Promise<boolean> {
      const now = new Date()
      const rows = await exec(params.tx)
        .update(organizations)
        .set({ status: "closed", deletedAt: now, updatedAt: now })
        .where(and(eq(organizations.id, params.id), isNull(organizations.deletedAt)))
        .returning({ id: organizations.id })
      return rows.length > 0
    },

    /** How many (not-deleted) organizations this user owns: used for the plan limit. */
    async countOwned(params: { ownerId: string; tx?: Tx }): Promise<number> {
      const [row] = await exec(params.tx)
        .select({ total: sqlCount() })
        .from(organizations)
        .innerJoin(organizationUsers, eq(organizationUsers.orgId, organizations.id))
        .where(ownedBy(params.ownerId))
      return row?.total ?? 0
    },

    /** Case-insensitive name check among the organizations this user owns. */
    async existsOwnedByName(params: {
      ownerId: string
      name: string
      excludeId?: string
      tx?: Tx
    }): Promise<boolean> {
      const [row] = await exec(params.tx)
        .select({ id: organizations.id })
        .from(organizations)
        .innerJoin(organizationUsers, eq(organizationUsers.orgId, organizations.id))
        .where(
          and(
            ownedBy(params.ownerId),
            sql`lower(${organizations.name}) = lower(${params.name})`,
            params.excludeId ? ne(organizations.id, params.excludeId) : undefined
          )
        )
        .limit(1)
      return !!row
    },

    /** Offset pagination: one page + the total for the same filter. */
    async listPage(params: {
      filter: OrganizationListFilter
      limit: number
      offset: number
      tx?: Tx
    }): Promise<{ items: Organization[]; total: number }> {
      const { filter, limit, offset, tx } = params
      const [items, [totalRow]] = await Promise.all([
        exec(tx)
          .select(getTableColumns(organizations))
          .from(organizations)
          .innerJoin(organizationUsers, eq(organizationUsers.orgId, organizations.id))
          .where(memberOf(filter))
          .orderBy(asc(organizations.name), asc(organizations.id))
          .limit(limit)
          .offset(offset),
        exec(tx)
          .select({ total: sqlCount() })
          .from(organizations)
          .innerJoin(organizationUsers, eq(organizationUsers.orgId, organizations.id))
          .where(memberOf(filter)),
      ])
      return { items, total: totalRow?.total ?? 0 }
    },

    /**
     * Keyset pagination for dropdowns: ordered by (name, id), `cursor` is the id of the
     * last row of the previous page. `cursor` must be a valid uuid (validate in the contract).
     */
    async listOptions(params: {
      filter: OrganizationListFilter
      limit: number
      cursor?: string
      tx?: Tx
    }): Promise<{ id: string; name: string }[]> {
      const { filter, limit, cursor, tx } = params
      const afterCursor = cursor
        ? sql`(${organizations.name}, ${organizations.id}) > (select o.name, o.id from organizations o where o.id = ${cursor})`
        : undefined
      return exec(tx)
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .innerJoin(organizationUsers, eq(organizationUsers.orgId, organizations.id))
        .where(and(memberOf(filter), afterCursor))
        .orderBy(asc(organizations.name), asc(organizations.id))
        .limit(limit)
    },

    async count(params: {
      filter: OrganizationListFilter
      tx?: Tx
    }): Promise<number> {
      const [row] = await exec(params.tx)
        .select({ total: sqlCount() })
        .from(organizations)
        .innerJoin(organizationUsers, eq(organizationUsers.orgId, organizations.id))
        .where(memberOf(params.filter))
      return row?.total ?? 0
    },
  } as const
}

/** The type to inject into the organization service (and to mock in tests). */
export type OrganizationRepository = ReturnType<
  typeof createOrganizationRepository
>
