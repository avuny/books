import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "@avuny/db"
import type { Database } from "@avuny/db"
import {
  auditEvents,
  sessions,
  userIdentifiers,
  users,
  type SessionRevokedReason,
} from "@avuny/db"

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdminUsersQuery {
  page: number
  pageSize: number
  q?: string
  status?: "active" | "suspended"
  identifierType?: "email" | "phone" | "username"
  createdFrom?: string
  createdTo?: string
  lastActiveFrom?: string
  lastActiveTo?: string
  sortBy: "createdAt" | "lastSignInAt" | "name"
  sortDir: "asc" | "desc"
}

// ── Users list (AD-1) ─────────────────────────────────────────────────────────

export async function listAdminUsers(
  db: Database,
  query: AdminUsersQuery
): Promise<{ items: AdminUserRow[]; total: number }> {
  const { page, pageSize, q, status, identifierType, sortBy, sortDir } = query
  const offset = (page - 1) * pageSize

  // Build where conditions
  const conditions = []

  if (status) {
    conditions.push(eq(users.status, status))
  }

  if (query.createdFrom) {
    conditions.push(gte(users.createdAt, new Date(query.createdFrom)))
  }
  if (query.createdTo) {
    conditions.push(lte(users.createdAt, new Date(query.createdTo)))
  }
  if (query.lastActiveFrom) {
    conditions.push(gte(users.lastActiveAt, new Date(query.lastActiveFrom)))
  }
  if (query.lastActiveTo) {
    conditions.push(lte(users.lastActiveAt, new Date(query.lastActiveTo)))
  }

  // Text search (q): matches name or any identifier value
  if (q) {
    const pattern = `%${q}%`
    const matchingUserIds = db
      .select({ userId: userIdentifiers.userId })
      .from(userIdentifiers)
      .where(ilike(userIdentifiers.value, pattern))

    conditions.push(
      or(ilike(users.name, pattern), sql`${users.id} = ANY(${matchingUserIds})`)
    )
  }

  // Identifier type filter: join to find users with at least one identifier of that type
  if (identifierType) {
    const matchingUserIds = db
      .select({ userId: userIdentifiers.userId })
      .from(userIdentifiers)
      .where(eq(userIdentifiers.type, identifierType))

    conditions.push(sql`${users.id} = ANY(${matchingUserIds})`)
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Order
  const orderFn = sortDir === "asc" ? asc : desc
  const orderCol =
    sortBy === "createdAt"
      ? users.createdAt
      : sortBy === "lastSignInAt"
        ? users.lastSignInAt
        : users.name

  // Count total
  const [countResult] = await db
    .select({ total: count() })
    .from(users)
    .where(where)

  const total = countResult?.total ?? 0

  // Fetch page
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(orderFn(orderCol))
    .limit(pageSize)
    .offset(offset)

  if (rows.length === 0) {
    return { items: [], total }
  }

  const userIds = rows.map((u) => u.id)

  // Fetch primary identifiers for all returned users in one query
  const primaryIdentifiers = await db
    .select()
    .from(userIdentifiers)
    .where(
      and(
        sql`${userIdentifiers.userId} = ANY(${sql.raw(`ARRAY[${userIds.map(() => "?").join(",")}]::uuid[]`).mapWith(() => "")}${userIds})`,
        eq(userIdentifiers.isPrimary, true)
      )
    )

  // Build a lookup map
  const primaryMap = new Map(primaryIdentifiers.map((i) => [i.userId, i]))

  const items: AdminUserRow[] = rows.map((u) => {
    const primary = primaryMap.get(u.id)
    return {
      id: u.id,
      name: u.name,
      status: u.status,
      platformRole: u.platformRole,
      avatarKey: u.avatarKey ?? null,
      primaryIdentifier: primary
        ? { type: primary.type, value: primary.value }
        : null,
      lastSignInAt: u.lastSignInAt ?? null,
      lastActiveAt: u.lastActiveAt ?? null,
      createdAt: u.createdAt,
    }
  })

  return { items, total }
}

export interface AdminUserRow {
  id: string
  name: string
  status: "active" | "suspended"
  platformRole: "user" | "support" | "admin"
  avatarKey: string | null
  primaryIdentifier: { type: "email" | "phone" | "username"; value: string } | null
  lastSignInAt: Date | null
  lastActiveAt: Date | null
  createdAt: Date
}

// ── User detail (AD-2) ────────────────────────────────────────────────────────

export interface AdminUserDetail {
  id: string
  name: string
  status: "active" | "suspended"
  platformRole: "user" | "support" | "admin"
  avatarKey: string | null
  suspendedAt: Date | null
  suspendedReason: string | null
  lastSignInAt: Date | null
  lastActiveAt: Date | null
  createdAt: Date
  identifiers: {
    id: string
    type: "email" | "phone" | "username"
    value: string
    isPrimary: boolean
    verifiedAt: Date | null
  }[]
  activeSessions: {
    id: string
    platform: "web" | "mobile"
    deviceName: string | null
    ipAddress: string | null
    lastUsedAt: Date
    createdAt: Date
  }[]
  recentActivity: {
    id: string
    eventType: string
    outcome: "success" | "failure"
    ipAddress: string | null
    userAgent: string | null
    metadata: Record<string, unknown>
    occurredAt: Date
  }[]
}

export async function findAdminUserDetail(
  db: Database,
  userId: string
): Promise<AdminUserDetail | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return null

  const [identifierRows, sessionRows, activityRows] = await Promise.all([
    db
      .select()
      .from(userIdentifiers)
      .where(eq(userIdentifiers.userId, userId))
      .orderBy(desc(userIdentifiers.isPrimary), asc(userIdentifiers.createdAt)),

    db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, sql`now()`)
        )
      )
      .orderBy(desc(sessions.lastUsedAt)),

    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.subjectUserId, userId))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(20),
  ])

  return {
    id: user.id,
    name: user.name,
    status: user.status,
    platformRole: user.platformRole,
    avatarKey: user.avatarKey ?? null,
    suspendedAt: user.suspendedAt ?? null,
    suspendedReason: user.suspendedReason ?? null,
    lastSignInAt: user.lastSignInAt ?? null,
    lastActiveAt: user.lastActiveAt ?? null,
    createdAt: user.createdAt,
    identifiers: identifierRows.map((i) => ({
      id: i.id,
      type: i.type,
      value: i.value,
      isPrimary: i.isPrimary,
      verifiedAt: i.verifiedAt ?? null,
    })),
    activeSessions: sessionRows.map((s) => ({
      id: s.id,
      platform: s.platform,
      deviceName: s.deviceName ?? null,
      ipAddress: s.ipAddress ? String(s.ipAddress) : null,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
    })),
    recentActivity: activityRows.map((a) => ({
      id: a.id,
      eventType: a.eventType,
      outcome: a.outcome,
      ipAddress: a.ipAddress ? String(a.ipAddress) : null,
      userAgent: a.userAgent ?? null,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
      occurredAt: a.occurredAt,
    })),
  }
}

// ── Suspend / reactivate (AD-3) ───────────────────────────────────────────────

export async function suspendUser(
  db: Database,
  userId: string,
  reason: string
): Promise<void> {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: "suspended", suspendedAt: now, suspendedReason: reason })
      .where(eq(users.id, userId))

    // Revoke all active sessions immediately (AD-3)
    await tx
      .update(sessions)
      .set({ revokedAt: now, revokedReason: "suspended" as SessionRevokedReason })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
  })
}

export async function reactivateUser(
  db: Database,
  userId: string
): Promise<void> {
  await db
    .update(users)
    .set({ status: "active", suspendedAt: null, suspendedReason: null })
    .where(eq(users.id, userId))
}

export async function revokeAllUserSessions(
  db: Database,
  userId: string
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: "admin" as SessionRevokedReason })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
}

// ── Activity log (AD-4) ───────────────────────────────────────────────────────

export interface AdminActivityQuery {
  page: number
  pageSize: number
  subjectUserId?: string
  eventType?: string
  outcome?: "success" | "failure"
  from?: string
  to?: string
  ipAddress?: string
}

export interface AdminActivityRow {
  id: string
  eventType: string
  outcome: "success" | "failure"
  actorUserId: string | null
  subjectUserId: string | null
  sessionId: string | null
  ipAddress: string | null
  userAgent: string | null
  requestId: string | null
  metadata: Record<string, unknown>
  occurredAt: Date
}

export async function listAdminActivity(
  db: Database,
  query: AdminActivityQuery
): Promise<{ items: AdminActivityRow[]; total: number }> {
  const { page, pageSize } = query
  const offset = (page - 1) * pageSize

  const conditions = []

  if (query.subjectUserId) {
    conditions.push(eq(auditEvents.subjectUserId, query.subjectUserId))
  }
  if (query.eventType) {
    conditions.push(eq(auditEvents.eventType, query.eventType))
  }
  if (query.outcome) {
    conditions.push(eq(auditEvents.outcome, query.outcome))
  }
  if (query.from) {
    conditions.push(gte(auditEvents.occurredAt, new Date(query.from)))
  }
  if (query.to) {
    conditions.push(lte(auditEvents.occurredAt, new Date(query.to)))
  }
  if (query.ipAddress) {
    conditions.push(
      sql`${auditEvents.ipAddress} = ${query.ipAddress}::inet`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [countResult] = await db
    .select({ total: count() })
    .from(auditEvents)
    .where(where)

  const total = countResult?.total ?? 0

  const rows = await db
    .select()
    .from(auditEvents)
    .where(where)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(pageSize)
    .offset(offset)

  const items: AdminActivityRow[] = rows.map((a) => ({
    id: a.id,
    eventType: a.eventType,
    outcome: a.outcome,
    actorUserId: a.actorUserId ?? null,
    subjectUserId: a.subjectUserId ?? null,
    sessionId: a.sessionId ?? null,
    ipAddress: a.ipAddress ? String(a.ipAddress) : null,
    userAgent: a.userAgent ?? null,
    requestId: a.requestId ?? null,
    metadata: (a.metadata as Record<string, unknown>) ?? {},
    occurredAt: a.occurredAt,
  }))

  return { items, total }
}

// ── Metrics overview (AD-5) ───────────────────────────────────────────────────

export interface MetricsResult {
  totalUsers: number
  newUsers: number
  dauUsers: number
  wauUsers: number
  mauUsers: number
  suspendedUsers: number
  signInsSuccess: number
  signInsFailure: number
  signUpsPerDay: { date: string; count: number }[]
}

function rangeToDays(range: "7d" | "30d" | "90d"): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90
}

export async function getAdminMetrics(
  db: Database,
  range: "7d" | "30d" | "90d"
): Promise<MetricsResult> {
  const days = rangeToDays(range)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalResult,
    newResult,
    suspendedResult,
    dauResult,
    wauResult,
    mauResult,
    signInSuccessResult,
    signInFailureResult,
    signUpsPerDayResult,
  ] = await Promise.all([
    // Total users
    db.select({ total: count() }).from(users),

    // New users in range
    db
      .select({ total: count() })
      .from(users)
      .where(gte(users.createdAt, since)),

    // Suspended users
    db
      .select({ total: count() })
      .from(users)
      .where(eq(users.status, "suspended")),

    // DAU: active in last 24h
    db
      .select({ total: count() })
      .from(users)
      .where(gte(users.lastActiveAt, oneDayAgo)),

    // WAU: active in last 7 days
    db
      .select({ total: count() })
      .from(users)
      .where(gte(users.lastActiveAt, sevenDaysAgo)),

    // MAU: active in last 30 days
    db
      .select({ total: count() })
      .from(users)
      .where(gte(users.lastActiveAt, thirtyDaysAgo)),

    // Sign-in successes in range
    db
      .select({ total: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventType, "auth.sign_in"),
          eq(auditEvents.outcome, "success"),
          gte(auditEvents.occurredAt, since)
        )
      ),

    // Sign-in failures in range
    db
      .select({ total: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventType, "auth.sign_in"),
          eq(auditEvents.outcome, "failure"),
          gte(auditEvents.occurredAt, since)
        )
      ),

    // Sign-ups per day (auth.sign_up events, grouped by date)
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${auditEvents.occurredAt}), 'YYYY-MM-DD')`,
        dayCount: count(),
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventType, "auth.sign_up"),
          eq(auditEvents.outcome, "success"),
          gte(auditEvents.occurredAt, since)
        )
      )
      .groupBy(sql`date_trunc('day', ${auditEvents.occurredAt})`)
      .orderBy(asc(sql`date_trunc('day', ${auditEvents.occurredAt})`) ),
  ])

  return {
    totalUsers: totalResult[0]?.total ?? 0,
    newUsers: newResult[0]?.total ?? 0,
    suspendedUsers: suspendedResult[0]?.total ?? 0,
    dauUsers: dauResult[0]?.total ?? 0,
    wauUsers: wauResult[0]?.total ?? 0,
    mauUsers: mauResult[0]?.total ?? 0,
    signInsSuccess: signInSuccessResult[0]?.total ?? 0,
    signInsFailure: signInFailureResult[0]?.total ?? 0,
    signUpsPerDay: signUpsPerDayResult.map((r) => ({
      date: r.date,
      count: Number(r.dayCount),
    })),
  }
}
