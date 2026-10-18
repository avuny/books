import { ok, fail, type Result } from "@avuny/utils"
import type { Database } from "@avuny/db"
import { AdminErrorCode } from "@avuny/contracts"
import { writeAuditEvent } from "../../audit/index.js"
import {
  findAdminUserDetail,
  listAdminUsers,
  listAdminActivity,
  getAdminMetrics,
  suspendUser,
  reactivateUser,
  revokeAllUserSessions,
  type AdminUsersQuery,
  type AdminActivityQuery,
} from "./admin.repo.js"

// ── Types ────────────────────────────────────────────────────────────────────

export type SuspendErrorCode =
  | typeof AdminErrorCode.CANNOT_SUSPEND_SELF
  | typeof AdminErrorCode.CANNOT_SUSPEND_ADMIN
  | typeof AdminErrorCode.USER_ALREADY_SUSPENDED
  | typeof AdminErrorCode.USER_NOT_FOUND

export type ReactivateErrorCode =
  | typeof AdminErrorCode.USER_NOT_FOUND
  | typeof AdminErrorCode.USER_NOT_SUSPENDED

export type RevokeSessionsErrorCode = typeof AdminErrorCode.USER_NOT_FOUND

// ── AD-1 List users ───────────────────────────────────────────────────────────

export { listAdminUsers, type AdminUsersQuery }

// ── AD-2 User detail (AD-6: viewing is audited) ──────────────────────────────

export interface GetUserDetailInput {
  targetUserId: string
  actorUserId: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export interface AdminUserDetailOutput {
  id: string
  name: string
  status: "active" | "suspended"
  platformRole: "user" | "support" | "admin"
  avatarUrl: string | null
  suspendedAt: string | null
  suspendedReason: string | null
  lastSignInAt: string | null
  lastActiveAt: string | null
  createdAt: string
  identifiers: {
    id: string
    type: "email" | "phone" | "username"
    value: string
    isPrimary: boolean
    verifiedAt: string | null
  }[]
  activeSessions: {
    id: string
    platform: "web" | "mobile"
    deviceName: string | null
    ipAddress: string | null
    lastUsedAt: string
    createdAt: string
  }[]
  recentActivity: {
    id: string
    eventType: string
    outcome: "success" | "failure"
    ipAddress: string | null
    userAgent: string | null
    metadata: Record<string, unknown>
    occurredAt: string
  }[]
}

export async function getAdminUserDetail(
  db: Database,
  input: GetUserDetailInput
): Promise<Result<AdminUserDetailOutput, typeof AdminErrorCode.USER_NOT_FOUND>> {
  const detail = await findAdminUserDetail(db, input.targetUserId)
  if (!detail) {
    return fail({
      error: AdminErrorCode.USER_NOT_FOUND,
      msg: "User not found",
    })
  }

  // AD-6: opening a user's detail is audited
  await writeAuditEvent(db, {
    eventType: "admin.user_viewed",
    outcome: "success",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: {},
  })

  return ok({
    data: {
      id: detail.id,
      name: detail.name,
      status: detail.status,
      platformRole: detail.platformRole,
      avatarUrl: null,
      suspendedAt: detail.suspendedAt?.toISOString() ?? null,
      suspendedReason: detail.suspendedReason,
      lastSignInAt: detail.lastSignInAt?.toISOString() ?? null,
      lastActiveAt: detail.lastActiveAt?.toISOString() ?? null,
      createdAt: detail.createdAt.toISOString(),
      identifiers: detail.identifiers.map((i) => ({
        id: i.id,
        type: i.type,
        value: i.value,
        isPrimary: i.isPrimary,
        verifiedAt: i.verifiedAt?.toISOString() ?? null,
      })),
      activeSessions: detail.activeSessions.map((s) => ({
        id: s.id,
        platform: s.platform,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        lastUsedAt: s.lastUsedAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      recentActivity: detail.recentActivity.map((a) => ({
        id: a.id,
        eventType: a.eventType,
        outcome: a.outcome,
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        metadata: a.metadata,
        occurredAt: a.occurredAt.toISOString(),
      })),
    },
    msg: "User detail fetched",
  })
}

// ── AD-3 Suspend ──────────────────────────────────────────────────────────────

export interface SuspendUserInput {
  actorUserId: string
  targetUserId: string
  reason: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export async function suspendUserAction(
  db: Database,
  input: SuspendUserInput
): Promise<Result<void, SuspendErrorCode>> {
  // Guardrail: cannot suspend self
  if (input.actorUserId === input.targetUserId) {
    return fail({
      error: AdminErrorCode.CANNOT_SUSPEND_SELF,
      msg: "Cannot suspend your own account",
    })
  }

  const detail = await findAdminUserDetail(db, input.targetUserId)
  if (!detail) {
    return fail({ error: AdminErrorCode.USER_NOT_FOUND, msg: "User not found" })
  }

  // Guardrail: cannot suspend another admin (AD-3)
  if (detail.platformRole === "admin") {
    return fail({
      error: AdminErrorCode.CANNOT_SUSPEND_ADMIN,
      msg: "Cannot suspend another admin",
    })
  }

  // Guardrail: already suspended
  if (detail.status === "suspended") {
    return fail({
      error: AdminErrorCode.USER_ALREADY_SUSPENDED,
      msg: "User is already suspended",
    })
  }

  await suspendUser(db, input.targetUserId, input.reason)

  await writeAuditEvent(db, {
    eventType: "admin.user_suspended",
    outcome: "success",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: { reason: input.reason },
  })

  return ok({ data: undefined, msg: "User suspended" })
}

// ── AD-3 Reactivate ───────────────────────────────────────────────────────────

export interface ReactivateUserInput {
  actorUserId: string
  targetUserId: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export async function reactivateUserAction(
  db: Database,
  input: ReactivateUserInput
): Promise<Result<void, ReactivateErrorCode>> {
  const detail = await findAdminUserDetail(db, input.targetUserId)
  if (!detail) {
    return fail({ error: AdminErrorCode.USER_NOT_FOUND, msg: "User not found" })
  }

  if (detail.status !== "suspended") {
    return fail({
      error: AdminErrorCode.USER_NOT_SUSPENDED,
      msg: "User is not suspended",
    })
  }

  await reactivateUser(db, input.targetUserId)

  await writeAuditEvent(db, {
    eventType: "admin.user_reactivated",
    outcome: "success",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: {},
  })

  return ok({ data: undefined, msg: "User reactivated" })
}

// ── AD-3 Revoke all sessions ──────────────────────────────────────────────────

export interface RevokeUserSessionsInput {
  actorUserId: string
  targetUserId: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export async function revokeUserSessionsAction(
  db: Database,
  input: RevokeUserSessionsInput
): Promise<Result<void, RevokeSessionsErrorCode>> {
  const detail = await findAdminUserDetail(db, input.targetUserId)
  if (!detail) {
    return fail({ error: AdminErrorCode.USER_NOT_FOUND, msg: "User not found" })
  }

  await revokeAllUserSessions(db, input.targetUserId)

  await writeAuditEvent(db, {
    eventType: "admin.sessions_revoked",
    outcome: "success",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: {},
  })

  return ok({ data: undefined, msg: "All sessions revoked" })
}

// ── AD-4 Activity log ─────────────────────────────────────────────────────────

export { listAdminActivity, type AdminActivityQuery }

// ── AD-5 Metrics overview ─────────────────────────────────────────────────────

export { getAdminMetrics }
