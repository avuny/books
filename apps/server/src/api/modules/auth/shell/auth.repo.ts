import { and, desc, eq, gt, gte, isNull, ne, sql } from "@avuny/db"

/**
 * Wraps an optional IP string for insertion into an inet column (D10, D13).
 * postgres.js cannot bind a plain JS string into an inet column: it serialises
 * it as text and postgres rejects the mismatch at bind time. Wrapping with
 * sql`cast` passes the string as a bound parameter (injection-safe) and lets
 * postgres perform the cast. Absent/null → SQL NULL.
 */
function inetParam(ip: string | undefined | null) {
  if (!ip) return null
  return sql`cast(${ip} as inet)`
}
import type { Database } from "@avuny/db"
import {
  sessions,
  users,
  auditEvents,
  type Session,
  type SessionPlatform,
  type SessionRevokedReason,
  type User,
} from "@avuny/db"

export interface CreateSessionInput {
  id?: string
  userId: string
  refreshTokenHash: string
  platform: SessionPlatform
  ipAddress?: string
  userAgent?: string
  deviceName?: string
  expiresAt: Date
}

export async function createSession(
  db: Database,
  input: CreateSessionInput
): Promise<Session> {
  const [row] = await db
    .insert(sessions)
    .values({
      ...(input.id ? { id: input.id } : {}),
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      platform: input.platform,
      ipAddress: inetParam(input.ipAddress) as unknown as string | undefined,
      userAgent: input.userAgent,
      deviceName: input.deviceName,
      expiresAt: input.expiresAt,
    })
    .returning()
  if (!row) {
    throw new Error("Failed to insert session")
  }
  return row
}

export async function findSessionById(
  db: Database,
  id: string
): Promise<Session | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1)
  return row ?? null
}

export async function findActiveSessionWithUser(
  db: Database,
  sid: string
): Promise<{ session: Session; user: User } | null> {
  const rows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sid),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
        eq(users.status, "active")
      )
    )
    .limit(1)

  return rows[0] ?? null
}

export async function findSessionByRefreshHash(
  db: Database,
  hash: string
): Promise<Session | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, hash))
    .limit(1)
  return row ?? null
}

export async function findSessionByPreviousRefreshHash(
  db: Database,
  hash: string
): Promise<Session | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.previousRefreshTokenHash, hash))
    .limit(1)
  return row ?? null
}

export async function rotateSession(
  db: Database,
  params: {
    currentHash: string
    newHash: string
    ttlSeconds: number
    absoluteTtlSeconds: number
  }
): Promise<Session | null> {
  const [row] = await db
    .update(sessions)
    .set({
      refreshTokenHash: params.newHash,
      previousRefreshTokenHash: params.currentHash,
      expiresAt: sql`LEAST(now() + (${params.ttlSeconds} || ' seconds')::interval, ${sessions.createdAt} + (${params.absoluteTtlSeconds} || ' seconds')::interval)`,
      lastUsedAt: sql`now()`,
    })
    .where(
      and(
        eq(sessions.refreshTokenHash, params.currentHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
        gt(
          sql`${sessions.createdAt} + (${params.absoluteTtlSeconds} || ' seconds')::interval`,
          sql`now()`
        )
      )
    )
    .returning()

  return row ?? null
}

export async function revokeSession(
  db: Database,
  sid: string,
  reason: SessionRevokedReason
): Promise<void> {
  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokedReason: reason,
    })
    .where(eq(sessions.id, sid))
}

export async function countFailedSignInsForIdentifier(
  db: Database,
  identifierHmac: string,
  since: Date
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.eventType, "auth.sign_in"),
        eq(auditEvents.outcome, "failure"),
        eq(auditEvents.identifierHmac, identifierHmac),
        gte(auditEvents.occurredAt, since)
      )
    )
  return result?.count ?? 0
}

export async function countFailedSignInsForIp(
  db: Database,
  ipAddress: string,
  since: Date
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.eventType, "auth.sign_in"),
        eq(auditEvents.outcome, "failure"),
        // Cast the JS string to inet on the postgres side. We pass it as a
        // regular parameter (drizzle binds ${ipAddress} safely) and let SQL
        // do the cast; this avoids sql.raw and is injection-safe.
        sql`${auditEvents.ipAddress} = cast(${ipAddress} as inet)`,
        gte(auditEvents.occurredAt, since)
      )
    )
  return result?.count ?? 0
}

export async function findActiveSessionsForUser(
  db: Database,
  userId: string
): Promise<Session[]> {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`)
      )
    )
    .orderBy(desc(sessions.lastUsedAt))
}

export async function revokeAllSessionsExcept(
  db: Database,
  userId: string,
  keepSessionId: string,
  reason: SessionRevokedReason
): Promise<void> {
  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokedReason: reason,
    })
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, keepSessionId),
        isNull(sessions.revokedAt)
      )
    )
}

export async function revokeAllSessionsForUser(
  db: Database,
  userId: string,
  reason: SessionRevokedReason
): Promise<void> {
  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokedReason: reason,
    })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      )
    )
}

export async function updateUserPassword(
  db: Database,
  userId: string,
  newPasswordHash: string
): Promise<void> {
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}
