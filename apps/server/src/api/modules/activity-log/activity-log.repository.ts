import { and, count, desc, eq, gte, lte } from "drizzle-orm"
import {
  organizationActivityLogs as logs,
  organizationUsers,
  type Database,
  type NewOrganizationActivityLog,
  type OrganizationActivityLog,
  type Tx,
} from "@avuny/db"
import type { ActivityLogOffsetListQuery } from "@avuny/contracts"

/** A log row plus the actor's username in this organization (null for system actions). */
export interface ActivityLogRow {
  log: OrganizationActivityLog
  actorUsername: string | null
}

export interface ActivityLogRepositoryDeps {
  db: Database
}

/**
 * Append-only: there is deliberately no update or delete.
 * Every method takes an optional `tx` so callers can join their own transaction.
 */
export function createActivityLogRepository({ db }: ActivityLogRepositoryDeps) {
  const exec = (tx?: Tx) => tx ?? db

  return {
    async insert(row: NewOrganizationActivityLog, tx?: Tx): Promise<void> {
      await exec(tx).insert(logs).values(row)
    },

    async list(
      orgId: string,
      query: ActivityLogOffsetListQuery,
      tx?: Tx
    ): Promise<{ rows: ActivityLogRow[]; total: number }> {
      const q = exec(tx)
      // `and()` skips the undefined conditions.
      const where = and(
        eq(logs.orgId, orgId),
        query.action ? eq(logs.action, query.action) : undefined,
        query.resource ? eq(logs.resource, query.resource) : undefined,
        query.resourceId ? eq(logs.resourceId, query.resourceId) : undefined,
        query.actorId ? eq(logs.actorId, query.actorId) : undefined,
        query.from ? gte(logs.createdAt, query.from) : undefined,
        query.to ? lte(logs.createdAt, query.to) : undefined
      )

      const rows = await q
        .select({ log: logs, actorUsername: organizationUsers.username })
        .from(logs)
        // Username lives on the membership, not on the user: it is per organization.
        .leftJoin(
          organizationUsers,
          and(
            eq(organizationUsers.orgId, logs.orgId),
            eq(organizationUsers.userId, logs.actorId)
          )
        )
        .where(where)
        .orderBy(desc(logs.createdAt), desc(logs.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)

      const [totalRow] = await q.select({ total: count() }).from(logs).where(where)
      return { rows, total: totalRow?.total ?? 0 }
    },
  }
}

export type ActivityLogRepository = ReturnType<typeof createActivityLogRepository>
