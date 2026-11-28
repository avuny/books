import bcrypt from "bcryptjs"
import { and, desc, eq, gt, isNull } from "@avuny/db"
import {
  platformAdminRoles,
  platformAdminSessions,
  platformAdmins,
  platformInvites,
  platformRoles,
  type DB,
  type PlatformAdmin,
  type PlatformAdminSession,
} from "@avuny/db"
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_LOGIN_LOCK_MINUTES,
  PLATFORM_LOGIN_MAX_FAILED_ATTEMPTS,
  PLATFORM_SESSION_ABSOLUTE_TTL_DAYS,
  PLATFORM_SESSION_IDLE_TTL_HOURS,
  PlatformAuthErrorCode as Code,
  type PlatformAdminDto,
  type PlatformSessionDto,
} from "@avuny/contracts/platform-admin"
import { fail, ok, type Result } from "@avuny/utils"
import { randomBytes } from "node:crypto"
import { config } from "../../config.js"
import { hashPlatformToken, normalizePlatformEmail } from "../platform-admin/platform-admin.bootstrap.js"
import { writePlatformAudit } from "./platform-auth.audit.js"
import {
  buildOtpauthUrl,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  signTicket,
  verifyTicket,
  verifyTotp,
} from "./platform-auth.crypto.js"

/**
 * Platform admin auth service (A1-04, PLATFORM-ADMIN-SPEC 3.2). Login only:
 * no route here or anywhere creates an admin without a valid invite (PAC1).
 *
 * Error discipline (PAC2): every credential failure returns INVALID_CREDENTIALS
 * with the same message, whether the email is unknown, the password wrong, the
 * TOTP code wrong, the account locked or disabled. The real reason is only in
 * the append-only audit log.
 */

export interface RequestContext {
  ipAddress: string | null
  userAgent: string | null
}

export interface IssuedSession {
  /** The raw token, returned once so the route can set the cookie. Never stored. */
  token: string
  session: PlatformAdminSession
}

const SESSION_IDLE_MS = PLATFORM_SESSION_IDLE_TTL_HOURS * 3_600_000
const SESSION_ABSOLUTE_MS = PLATFORM_SESSION_ABSOLUTE_TTL_DAYS * 24 * 3_600_000
const LOCK_MS = PLATFORM_LOGIN_LOCK_MINUTES * 60_000
/** Sliding idle renewal writes at most once per this interval per session. */
const SESSION_RENEW_MIN_INTERVAL_MS = 15 * 60_000

/* ------------------------------------------------------------------ passwords */

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, config.BCRYPT_ROUNDS)

const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash)

let dummyHashPromise: Promise<string> | undefined
/** Constant-time shape for unknown emails: compare against a real bcrypt hash. */
const verifyDummyPassword = (password: string): Promise<boolean> => {
  dummyHashPromise ??= bcrypt.hash("platform-auth-dummy-password", config.BCRYPT_ROUNDS)
  return dummyHashPromise.then((hash) => bcrypt.compare(password, hash))
}

/* ---------------------------------------------------------------------- DTOs */

export const toPlatformAdminDto = (
  admin: PlatformAdmin,
  roleKeys: string[]
): PlatformAdminDto => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  status: admin.status,
  roles: roleKeys,
  lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
  totpEnabledAt: admin.totpEnabledAt?.toISOString() ?? null,
  createdAt: admin.createdAt.toISOString(),
})

const toSessionDto = (
  session: PlatformAdminSession,
  currentSessionId: string
): PlatformSessionDto => ({
  id: session.id,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  createdAt: session.createdAt.toISOString(),
  expiresAt: session.expiresAt.toISOString(),
  current: session.id === currentSessionId,
})

export async function loadRoleKeys(db: DB, adminId: string): Promise<string[]> {
  const rows = await db
    .select({ key: platformRoles.key })
    .from(platformAdminRoles)
    .innerJoin(platformRoles, eq(platformAdminRoles.roleId, platformRoles.id))
    .where(eq(platformAdminRoles.adminId, adminId))
  return rows.map((row) => row.key)
}

/* ------------------------------------------------------------ failure helpers */

type AuthFail = Result<never, typeof Code.INVALID_CREDENTIALS>

const isLocked = (admin: PlatformAdmin): boolean =>
  admin.lockedUntil !== null && admin.lockedUntil.getTime() > Date.now()

/**
 * Records a failed attempt (PA-R6: every attempt is audited) and applies the
 * lockout counter: PLATFORM_LOGIN_MAX_FAILED_ATTEMPTS failures lock the account
 * for PLATFORM_LOGIN_LOCK_MINUTES minutes.
 */
async function registerFailedAttempt(
  db: DB,
  admin: PlatformAdmin,
  reason: string,
  ctx: RequestContext
): Promise<void> {
  const failedAttempts = admin.failedAttempts + 1
  const lockedUntil =
    failedAttempts >= PLATFORM_LOGIN_MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_MS)
      : null
  await db
    .update(platformAdmins)
    .set({
      failedAttempts,
      ...(lockedUntil ? { lockedUntil } : {}),
      updatedAt: new Date(),
    })
    .where(eq(platformAdmins.id, admin.id))
  await writePlatformAudit(db, {
    adminId: admin.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
    resource: "platform-admin",
    resourceId: admin.id,
    after: { reason, failedAttempts, locked: lockedUntil !== null },
    ipAddress: ctx.ipAddress,
  })
}

const invalidCredentials = (msg: string): AuthFail =>
  fail({ error: Code.INVALID_CREDENTIALS, msg })

/* -------------------------------------------------------------------- login */

export interface LoginInput {
  email: string
  password: string
}

/** Step 1: email + password. Success returns a signed ticket for the TOTP step. */
export async function login(
  db: DB,
  input: LoginInput,
  ctx: RequestContext
): Promise<Result<{ pendingToken: string; expiresAt: string }, typeof Code.INVALID_CREDENTIALS>> {
  const email = normalizePlatformEmail(input.email)
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.email, email))
    .limit(1)

  if (!admin) {
    // Same work, same response: no account enumeration (spec 3.2).
    await verifyDummyPassword(input.password)
    await writePlatformAudit(db, {
      adminId: null,
      action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
      resource: "platform-admin",
      after: { reason: "unknown_email", email },
      ipAddress: ctx.ipAddress,
    })
    return invalidCredentials("Unknown email")
  }

  if (admin.status === "disabled") {
    await verifyDummyPassword(input.password)
    await registerFailedAttempt(db, admin, "disabled", ctx)
    return invalidCredentials("Account disabled")
  }
  if (isLocked(admin)) {
    await verifyDummyPassword(input.password)
    await writePlatformAudit(db, {
      adminId: admin.id,
      action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
      resource: "platform-admin",
      resourceId: admin.id,
      after: { reason: "locked" },
      ipAddress: ctx.ipAddress,
    })
    return invalidCredentials("Account locked")
  }
  if (!(await verifyPassword(input.password, admin.passwordHash))) {
    await registerFailedAttempt(db, admin, "bad_password", ctx)
    return invalidCredentials("Wrong password")
  }
  if (admin.status !== "active" || !admin.totpSecretEnc) {
    // Invited (enrollment not finished) or inconsistent: no password-only path in.
    await registerFailedAttempt(db, admin, "not_active", ctx)
    return invalidCredentials("Account not active")
  }

  const { token, expiresAt } = signTicket({ pur: "login", sub: admin.id })
  return ok({
    data: { pendingToken: token, expiresAt: expiresAt.toISOString() },
  })
}

/** Step 2: TOTP code against the ticket from step 1. Success issues a session. */
export async function verifyLoginTotp(
  db: DB,
  input: { pendingToken: string; code: string },
  ctx: RequestContext
): Promise<
  Result<
    { admin: PlatformAdminDto; issued: IssuedSession },
    typeof Code.INVALID_CREDENTIALS | typeof Code.INVALID_TICKET
  >
> {
  const payload = verifyTicket(input.pendingToken, "login")
  if (!payload) {
    return fail({ error: Code.INVALID_TICKET, msg: "Bad login ticket" })
  }
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, payload.sub))
    .limit(1)
  if (!admin || admin.status !== "active" || !admin.totpSecretEnc) {
    return fail({ error: Code.INVALID_TICKET, msg: "Ticket admin unusable" })
  }
  if (isLocked(admin)) {
    await writePlatformAudit(db, {
      adminId: admin.id,
      action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
      resource: "platform-admin",
      resourceId: admin.id,
      after: { reason: "locked" },
      ipAddress: ctx.ipAddress,
    })
    return invalidCredentials("Account locked")
  }

  let secret: string
  try {
    secret = decryptTotpSecret(admin.totpSecretEnc)
  } catch {
    // Undecryptable secret is a server fault, not a credential failure.
    throw new Error(`TOTP secret for admin ${admin.id} cannot be decrypted`)
  }
  if (!verifyTotp(secret, input.code)) {
    await registerFailedAttempt(db, admin, "bad_totp", ctx)
    return invalidCredentials("Wrong TOTP code")
  }

  const now = new Date()
  await db
    .update(platformAdmins)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now })
    .where(eq(platformAdmins.id, admin.id))
  const issued = await createSession(db, admin.id, ctx)
  await writePlatformAudit(db, {
    adminId: admin.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN,
    resource: "platform-admin-session",
    resourceId: issued.session.id,
    ipAddress: ctx.ipAddress,
  })
  const roleKeys = await loadRoleKeys(db, admin.id)
  return ok({
    data: {
      admin: toPlatformAdminDto({ ...admin, lastLoginAt: now }, roleKeys),
      issued,
    },
  })
}

/* ------------------------------------------------------------------ sessions */

async function createSession(
  db: DB,
  adminId: string,
  ctx: RequestContext
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_IDLE_MS)
  const [session] = await db
    .insert(platformAdminSessions)
    .values({
      adminId,
      tokenHash: hashPlatformToken(token),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt,
    })
    .returning()
  return { token, session: session! }
}

export interface AuthenticatedSession {
  admin: PlatformAdmin
  session: PlatformAdminSession
}

/**
 * Resolves a raw session token to the live admin + session, enforcing idle
 * expiry (8h sliding), the 7-day absolute cap and revocation. Renews the idle
 * expiry at most once per 15 minutes (PA login rules).
 */
export async function resolveSession(
  db: DB,
  token: string
): Promise<AuthenticatedSession | null> {
  const [row] = await db
    .select({ session: platformAdminSessions, admin: platformAdmins })
    .from(platformAdminSessions)
    .innerJoin(
      platformAdmins,
      eq(platformAdminSessions.adminId, platformAdmins.id)
    )
    .where(eq(platformAdminSessions.tokenHash, hashPlatformToken(token)))
    .limit(1)
  if (!row) return null
  const { session, admin } = row
  const now = Date.now()
  if (session.revokedAt !== null) return null
  if (session.expiresAt.getTime() <= now) return null
  if (session.createdAt.getTime() + SESSION_ABSOLUTE_MS <= now) return null
  if (admin.status !== "active") return null

  if (session.updatedAt.getTime() + SESSION_RENEW_MIN_INTERVAL_MS <= now) {
    const expiresAt = new Date(
      Math.min(now + SESSION_IDLE_MS, session.createdAt.getTime() + SESSION_ABSOLUTE_MS)
    )
    await db
      .update(platformAdminSessions)
      .set({ expiresAt, updatedAt: new Date(now) })
      .where(eq(platformAdminSessions.id, session.id))
    return { admin, session: { ...session, expiresAt } }
  }
  return { admin, session }
}

export async function logout(
  db: DB,
  session: PlatformAdminSession,
  ctx: RequestContext
): Promise<void> {
  await db
    .update(platformAdminSessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(platformAdminSessions.id, session.id))
  await writePlatformAudit(db, {
    adminId: session.adminId,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGOUT,
    resource: "platform-admin-session",
    resourceId: session.id,
    ipAddress: ctx.ipAddress,
  })
}

export async function listSessions(
  db: DB,
  adminId: string,
  currentSessionId: string
): Promise<PlatformSessionDto[]> {
  const rows = await db
    .select()
    .from(platformAdminSessions)
    .where(
      and(
        eq(platformAdminSessions.adminId, adminId),
        isNull(platformAdminSessions.revokedAt),
        gt(platformAdminSessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(platformAdminSessions.createdAt))
  return rows.map((row) => toSessionDto(row, currentSessionId))
}

/** Revokes one of the caller's own sessions (self-service; admin management is A1-05). */
export async function revokeSession(
  db: DB,
  adminId: string,
  sessionId: string,
  ctx: RequestContext
): Promise<Result<null, typeof Code.SESSION_NOT_FOUND>> {
  const [session] = await db
    .update(platformAdminSessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(platformAdminSessions.id, sessionId),
        eq(platformAdminSessions.adminId, adminId),
        isNull(platformAdminSessions.revokedAt)
      )
    )
    .returning({ id: platformAdminSessions.id })
  if (!session) {
    return fail({ error: Code.SESSION_NOT_FOUND, msg: "Not a live own session" })
  }
  await writePlatformAudit(db, {
    adminId,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
    resource: "platform-admin-session",
    resourceId: session.id,
    ipAddress: ctx.ipAddress,
  })
  return ok({ data: null })
}

/* ----------------------------------------------- invite acceptance + enrollment */

export interface AcceptInviteResult {
  enrollmentTicket: string
  totpSecret: string
  otpauthUrl: string
  expiresAt: string
}

const findUsableInvite = async (db: DB, token: string) => {
  const [invite] = await db
    .select()
    .from(platformInvites)
    .where(eq(platformInvites.tokenHash, hashPlatformToken(token)))
    .limit(1)
  if (!invite) return null
  if (invite.acceptedAt !== null || invite.revokedAt !== null) return null
  if (invite.expiresAt.getTime() <= Date.now()) return null
  return invite
}

/**
 * Step 1 of joining: the invitee sets name and password. Creates the admin in
 * `invited` status (no session possible yet) and returns a one-time TOTP secret
 * plus a signed enrollment ticket. The admin becomes active only when the first
 * TOTP code verifies (mandatory TOTP, Q16).
 */
export async function acceptInvite(
  db: DB,
  input: { token: string; name: string; password: string }
): Promise<Result<AcceptInviteResult, typeof Code.INVALID_INVITE>> {
  const invite = await findUsableInvite(db, input.token)
  if (!invite) {
    return fail({ error: Code.INVALID_INVITE, msg: "Invite not usable" })
  }
  const [existing] = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.email, invite.email))
    .limit(1)
  if (existing) {
    // Same generic response: the invite state must not reveal account state.
    return fail({ error: Code.INVALID_INVITE, msg: "Admin already exists" })
  }

  const passwordHash = await hashPassword(input.password)
  const [admin] = await db
    .insert(platformAdmins)
    .values({
      email: invite.email,
      name: input.name.trim(),
      passwordHash,
      status: "invited",
      createdBy: invite.invitedBy,
    })
    .returning()

  const totpSecret = generateTotpSecret()
  const { token: enrollmentTicket, expiresAt } = signTicket({
    pur: "enroll",
    sub: invite.id,
    aid: admin!.id,
    sec: totpSecret,
  })
  return ok({
    data: {
      enrollmentTicket,
      totpSecret,
      otpauthUrl: buildOtpauthUrl(totpSecret, invite.email),
      expiresAt: expiresAt.toISOString(),
    },
  })
}

/**
 * Step 2: the first TOTP code against the pending secret proves the enrollment.
 * Activates the admin, grants exactly the invite's roles, consumes the invite
 * and signs the admin in (spec 3.2: "then lands in the app").
 */
export async function confirmEnrollment(
  db: DB,
  input: { enrollmentTicket: string; code: string },
  ctx: RequestContext
): Promise<
  Result<
    { admin: PlatformAdminDto; issued: IssuedSession },
    typeof Code.INVALID_TICKET | typeof Code.INVALID_CREDENTIALS
  >
> {
  const payload = verifyTicket(input.enrollmentTicket, "enroll")
  if (!payload?.aid || !payload.sec) {
    return fail({ error: Code.INVALID_TICKET, msg: "Bad enrollment ticket" })
  }
  const [invite] = await db
    .select()
    .from(platformInvites)
    .where(eq(platformInvites.id, payload.sub))
    .limit(1)
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, payload.aid))
    .limit(1)
  if (
    !invite ||
    invite.acceptedAt !== null ||
    invite.revokedAt !== null ||
    invite.expiresAt.getTime() <= Date.now() ||
    !admin ||
    admin.status !== "invited"
  ) {
    return fail({ error: Code.INVALID_TICKET, msg: "Enrollment no longer valid" })
  }
  if (!verifyTotp(payload.sec, input.code)) {
    await writePlatformAudit(db, {
      adminId: admin.id,
      action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
      resource: "platform-admin",
      resourceId: admin.id,
      after: { reason: "bad_enroll_totp" },
      ipAddress: ctx.ipAddress,
    })
    return invalidCredentials("Wrong enrollment TOTP code")
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(platformAdmins)
      .set({
        status: "active",
        totpSecretEnc: encryptTotpSecret(payload.sec!),
        totpEnabledAt: now,
        updatedAt: now,
      })
      .where(eq(platformAdmins.id, admin!.id))
    await tx.insert(platformAdminRoles).values(
      invite!.roleIds.map((roleId) => ({ adminId: admin!.id, roleId }))
    )
    await tx
      .update(platformInvites)
      .set({ acceptedAt: now, updatedAt: now })
      .where(eq(platformInvites.id, invite!.id))

    await writePlatformAudit(tx, {
      adminId: admin!.id,
      action: PLATFORM_AUDIT_ACTIONS.ADMIN_INVITE_ACCEPTED,
      resource: "platform-admin",
      resourceId: admin!.id,
      after: { email: invite!.email, roleIds: invite!.roleIds },
      ipAddress: ctx.ipAddress,
    })
  })

  const issued = await createSession(db, admin.id, ctx)
  await writePlatformAudit(db, {
    adminId: admin.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN,
    resource: "platform-admin-session",
    resourceId: issued.session.id,
    ipAddress: ctx.ipAddress,
  })

  const roleKeys = await loadRoleKeys(db, admin.id)
  return ok({
    data: {
      admin: toPlatformAdminDto(
        { ...admin, status: "active", totpEnabledAt: now },
        roleKeys
      ),
      issued,
    },
  })
}
