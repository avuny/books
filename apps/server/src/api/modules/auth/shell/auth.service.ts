import { ok, fail, type Result } from "@avuny/utils"
import type { Database } from "@avuny/db"
import {
  AuthErrorCode,
  OtpErrorCode,
  type AuthResponseSchema,
  type RefreshResponseSchema,
} from "@avuny/contracts"
import { type z } from "@avuny/zod"
import { config } from "../../../config.js"
import { writeAuditEvent, computeIdentifierHmac } from "../../audit/index.js"
import { consumeVerificationProof } from "../../otp/index.js"
import { getMessageSender } from "../../messaging/index.js"
import { scheduleBackground } from "../../../background-runner.js"
import {
  createUser,
  findUserById,
  findUserByIdentifier,
  normalizeIdentifier,
  updateUserLastSignIn,
  updateUserLastActive,
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  validatePassword,
} from "../../users/index.js"
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../core/auth.crypto.js"
import {
  createSession,
  rotateSession,
  revokeSession,
  findSessionById,
  findSessionByPreviousRefreshHash,
  countFailedSignInsForIdentifier,
  countFailedSignInsForIp,
  findActiveSessionsForUser,
  revokeAllSessionsExcept,
  revokeAllSessionsForUser,
  updateUserPassword,
} from "./auth.repo.js"

export type AuthResponse = z.infer<typeof AuthResponseSchema>
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>

export interface SignUpInput {
  identifier: string
  name: string
  password: string
  verificationToken: string
  platform: "web" | "mobile"
  ipAddress?: string
  userAgent?: string
  deviceName?: string
  requestId?: string
}

export interface AuthSuccessData {
  authResponse: AuthResponse
  rawRefreshToken: string
}

export type SignUpErrorCode =
  | typeof AuthErrorCode.INVALID_CREDENTIALS
  | typeof AuthErrorCode.WEAK_PASSWORD
  | typeof AuthErrorCode.INVALID_IDENTIFIER_TYPE

export type SignInErrorCode =
  | typeof AuthErrorCode.INVALID_CREDENTIALS
  | typeof AuthErrorCode.ACCOUNT_SUSPENDED
  | typeof AuthErrorCode.TOO_MANY_ATTEMPTS

export type RefreshErrorCode =
  | typeof AuthErrorCode.REFRESH_TOKEN_INVALID
  | typeof AuthErrorCode.REFRESH_TOKEN_REUSED
  | typeof AuthErrorCode.INVALID_CREDENTIALS

export async function signUp(
  db: Database,
  input: SignUpInput
): Promise<Result<AuthSuccessData, SignUpErrorCode>> {
  const normalized = normalizeIdentifier(input.identifier)

  // 1. Consume verification proof (D8)
  const proofResult = await consumeVerificationProof(db, {
    verificationToken: input.verificationToken,
    expectedPurpose: "SIGN_UP",
    expectedIdentifier: normalized,
  })

  if (!proofResult.success) {
    return fail({
      error: AuthErrorCode.INVALID_CREDENTIALS,
      msg: "Verification code or token is invalid",
    })
  }

  // 2. Create user with primary identifier
  const userResult = await createUser(db, {
    name: input.name,
    password: input.password,
    identifier: normalized,
  })

  if (!userResult.success) {
    return fail({
      error: AuthErrorCode.INVALID_CREDENTIALS,
      msg: userResult.msg || "Failed to create user",
    })
  }

  const { user, identifier } = userResult.data

  // 3. Issue session and tokens (D4, D5)
  const refreshToken = generateRefreshToken()
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const expiresAt = new Date(
    Date.now() +
      Math.min(config.REFRESH_TOKEN_TTL, config.SESSION_ABSOLUTE_TTL) * 1000
  )

  const session = await createSession(db, {
    userId: user.id,
    refreshTokenHash,
    platform: input.platform,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceName: input.deviceName,
    expiresAt,
  })

  const { accessToken, accessTokenExpiresAt } = signAccessToken({
    sub: user.id,
    sid: session.id,
  })

  const identifierHmac = computeIdentifierHmac(normalized)

  // 4. Write audit event
  await writeAuditEvent(db, {
    eventType: "auth.sign_up",
    outcome: "success",
    subjectUserId: user.id,
    sessionId: session.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    identifierHmac,
    metadata: { platform: input.platform },
  })

  return ok({
    data: {
      authResponse: {
        user: {
          id: user.id,
          name: user.name,
          identifier: identifier.value,
          identifierType: identifier.type,
          avatarUrl: null,
          platformRole: user.platformRole,
        },
        tokens: {
          accessToken,
          accessTokenExpiresAt,
          ...(input.platform === "mobile" ? { refreshToken } : {}),
        },
      },
      rawRefreshToken: refreshToken,
    },
    msg: "Sign up successful",
  })
}

export interface SignInInput {
  identifier: string
  password: string
  platform: "web" | "mobile"
  ipAddress?: string
  userAgent?: string
  deviceName?: string
  requestId?: string
}

export async function signIn(
  db: Database,
  input: SignInInput
): Promise<Result<AuthSuccessData, SignInErrorCode>> {
  const normalized = normalizeIdentifier(input.identifier)
  const identifierHmac = computeIdentifierHmac(normalized)
  const now = Date.now()

  // 1. Postgres-backed sign-in throttling (D10)
  const windowStart = new Date(now - config.SIGNIN_THROTTLE_WINDOW * 1000)
  const failedByIdentifier = await countFailedSignInsForIdentifier(
    db,
    identifierHmac,
    windowStart
  )
  const failedByIp = input.ipAddress
    ? await countFailedSignInsForIp(db, input.ipAddress, windowStart)
    : 0

  if (
    failedByIdentifier >= config.SIGNIN_MAX_FAILURES_PER_IDENTIFIER ||
    failedByIp >= config.SIGNIN_MAX_FAILURES_PER_IP
  ) {
    return fail({
      error: AuthErrorCode.TOO_MANY_ATTEMPTS,
      msg: "Too many failed attempts. Please try again later.",
    })
  }

  // 2. Find user by identifier
  const found = await findUserByIdentifier(db, normalized)
  if (!found) {
    await verifyDummyPassword(input.password)
    await writeAuditEvent(db, {
      eventType: "auth.sign_in",
      outcome: "failure",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      identifierHmac,
      metadata: { reason: "not_found" },
    })
    return fail({
      error: AuthErrorCode.INVALID_CREDENTIALS,
      msg: "Invalid credentials",
    })
  }

  // 3. Verify password
  const isMatch = await verifyPassword(input.password, found.user.passwordHash)
  if (!isMatch) {
    await writeAuditEvent(db, {
      eventType: "auth.sign_in",
      outcome: "failure",
      subjectUserId: found.user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      identifierHmac,
      metadata: { reason: "wrong_password" },
    })
    return fail({
      error: AuthErrorCode.INVALID_CREDENTIALS,
      msg: "Invalid credentials",
    })
  }

  // 4. Check account suspension (D9: returned only after correct password)
  if (found.user.status === "suspended") {
    await writeAuditEvent(db, {
      eventType: "auth.sign_in",
      outcome: "failure",
      subjectUserId: found.user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      identifierHmac,
      metadata: { reason: "suspended" },
    })
    return fail({
      error: AuthErrorCode.ACCOUNT_SUSPENDED,
      msg: "Account is suspended",
    })
  }

  // 5. Update last sign-in
  await updateUserLastSignIn(db, found.user.id)

  // 6. Create session and tokens
  const refreshToken = generateRefreshToken()
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const expiresAt = new Date(
    now +
      Math.min(config.REFRESH_TOKEN_TTL, config.SESSION_ABSOLUTE_TTL) * 1000
  )

  const session = await createSession(db, {
    userId: found.user.id,
    refreshTokenHash,
    platform: input.platform,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceName: input.deviceName,
    expiresAt,
  })

  const { accessToken, accessTokenExpiresAt } = signAccessToken({
    sub: found.user.id,
    sid: session.id,
  })

  // 7. Write audit event
  await writeAuditEvent(db, {
    eventType: "auth.sign_in",
    outcome: "success",
    subjectUserId: found.user.id,
    sessionId: session.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    identifierHmac,
    metadata: { platform: input.platform },
  })

  return ok({
    data: {
      authResponse: {
        user: {
          id: found.user.id,
          name: found.user.name,
          identifier: found.identifier.value,
          identifierType: found.identifier.type,
          avatarUrl: null,
          platformRole: found.user.platformRole,
        },
        tokens: {
          accessToken,
          accessTokenExpiresAt,
          ...(input.platform === "mobile" ? { refreshToken } : {}),
        },
      },
      rawRefreshToken: refreshToken,
    },
    msg: "Sign in successful",
  })
}

export interface RefreshInput {
  presentedToken: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export interface RefreshSuccessData {
  refreshResponse: RefreshResponse
  rawRefreshToken: string
  platform: "web" | "mobile"
}

export async function refresh(
  db: Database,
  input: RefreshInput
): Promise<Result<RefreshSuccessData, RefreshErrorCode>> {
  const currentHash = hashRefreshToken(input.presentedToken)
  const newRefreshToken = generateRefreshToken()
  const newHash = hashRefreshToken(newRefreshToken)

  // Atomic rotation with absolute cap enforcement (D4)
  const rotated = await rotateSession(db, {
    currentHash,
    newHash,
    ttlSeconds: config.REFRESH_TOKEN_TTL,
    absoluteTtlSeconds: config.SESSION_ABSOLUTE_TTL,
  })

  if (rotated) {
    await updateUserLastActive(db, rotated.userId)

    const { accessToken, accessTokenExpiresAt } = signAccessToken({
      sub: rotated.userId,
      sid: rotated.id,
    })

    return ok({
      data: {
        refreshResponse: {
          tokens: {
            accessToken,
            accessTokenExpiresAt,
            ...(rotated.platform === "mobile"
              ? { refreshToken: newRefreshToken }
              : {}),
          },
        },
        rawRefreshToken: newRefreshToken,
        platform: rotated.platform,
      },
      msg: "Token refreshed successfully",
    })
  }

  // If rotation failed, check reuse detection (D4)
  const reusedSession = await findSessionByPreviousRefreshHash(db, currentHash)
  if (reusedSession) {
    await revokeSession(db, reusedSession.id, "reuse_detected")
    await writeAuditEvent(db, {
      eventType: "auth.refresh_reuse_detected",
      outcome: "failure",
      subjectUserId: reusedSession.userId,
      sessionId: reusedSession.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      metadata: { platform: reusedSession.platform },
    })

    return fail({
      error: AuthErrorCode.REFRESH_TOKEN_REUSED,
      msg: "Refresh token reuse detected; session revoked",
    })
  }

  return fail({
    error: AuthErrorCode.REFRESH_TOKEN_INVALID,
    msg: "Invalid or expired session",
  })
}

export interface SignOutInput {
  sessionId: string
  userId: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export async function signOut(
  db: Database,
  input: SignOutInput
): Promise<Result<void, AuthErrorCode>> {
  await revokeSession(db, input.sessionId, "sign_out")

  await writeAuditEvent(db, {
    eventType: "auth.sign_out",
    outcome: "success",
    subjectUserId: input.userId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
  })

  return ok({
    data: undefined,
    msg: "Signed out successfully",
  })
}

// ── Slice 2: Security ────────────────────────────────────────────────────────

export interface ChangePasswordInput {
  userId: string
  currentSessionId: string
  currentPassword: string
  newPassword: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export type ChangePasswordErrorCode =
  | typeof AuthErrorCode.INVALID_CURRENT_PASSWORD
  | typeof AuthErrorCode.WEAK_PASSWORD

export async function changePassword(
  db: Database,
  input: ChangePasswordInput
): Promise<Result<void, ChangePasswordErrorCode>> {
  // Validate new password rules (8 chars, 72 bytes)
  const validationError = validatePassword(input.newPassword)
  if (validationError) {
    return fail({
      error: AuthErrorCode.WEAK_PASSWORD,
      msg: validationError,
    })
  }

  const userRecord = await findUserById(db, input.userId)
  if (!userRecord) {
    return fail({
      error: AuthErrorCode.INVALID_CURRENT_PASSWORD,
      msg: "Invalid user",
    })
  }

  const isCurrentValid = await verifyPassword(
    input.currentPassword,
    userRecord.user.passwordHash
  )
  if (!isCurrentValid) {
    await writeAuditEvent(db, {
      eventType: "auth.password_changed",
      outcome: "failure",
      subjectUserId: input.userId,
      sessionId: input.currentSessionId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      metadata: { reason: "invalid_current_password" },
    })

    return fail({
      error: AuthErrorCode.INVALID_CURRENT_PASSWORD,
      msg: "Current password incorrect",
    })
  }

  const newHash = await hashPassword(input.newPassword)
  await updateUserPassword(db, input.userId, newHash)

  // Revoke every other session with reason password_changed (D4, Slice 2)
  await revokeAllSessionsExcept(
    db,
    input.userId,
    input.currentSessionId,
    "password_changed"
  )

  await writeAuditEvent(db, {
    eventType: "auth.password_changed",
    outcome: "success",
    subjectUserId: input.userId,
    sessionId: input.currentSessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
  })

  return ok({
    data: undefined,
    msg: "Password changed successfully",
  })
}

export interface SignOutAllInput {
  userId: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export async function signOutAll(
  db: Database,
  input: SignOutAllInput
): Promise<Result<void, AuthErrorCode>> {
  await revokeAllSessionsForUser(db, input.userId, "sign_out_all")

  await writeAuditEvent(db, {
    eventType: "auth.sign_out",
    outcome: "success",
    subjectUserId: input.userId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: { allDevices: true },
  })

  return ok({
    data: undefined,
    msg: "Signed out of all devices",
  })
}

export interface SessionItemOutput {
  id: string
  platform: "web" | "mobile"
  deviceName: string | null
  ipAddress: string | null
  createdAt: string
  lastUsedAt: string
  current: boolean
}

export async function listSessions(
  db: Database,
  input: { userId: string; currentSessionId: string }
): Promise<SessionItemOutput[]> {
  const sessionRows = await findActiveSessionsForUser(db, input.userId)

  return sessionRows.map((s) => ({
    id: s.id,
    platform: s.platform,
    deviceName: s.deviceName ?? null,
    ipAddress: s.ipAddress ? String(s.ipAddress) : null,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    current: s.id === input.currentSessionId,
  }))
}

export interface RevokeUserSessionInput {
  userId: string
  targetSessionId: string
  currentSessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export async function revokeUserSession(
  db: Database,
  input: RevokeUserSessionInput
): Promise<Result<void, typeof AuthErrorCode.SESSION_NOT_FOUND>> {
  const session = await findSessionById(db, input.targetSessionId)
  if (
    !session ||
    session.userId !== input.userId ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    return fail({
      error: AuthErrorCode.SESSION_NOT_FOUND,
      msg: "Session not found",
    })
  }

  await revokeSession(db, input.targetSessionId, "sign_out")

  await writeAuditEvent(db, {
    eventType: "session.revoked",
    outcome: "success",
    subjectUserId: input.userId,
    sessionId: input.targetSessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
  })

  return ok({
    data: undefined,
    msg: "Session revoked successfully",
  })
}

export interface ResetPasswordInput {
  verificationToken: string
  newPassword: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export type ResetPasswordErrorCode =
  | typeof OtpErrorCode.VERIFICATION_TOKEN_INVALID
  | typeof AuthErrorCode.WEAK_PASSWORD

export async function resetPassword(
  db: Database,
  input: ResetPasswordInput
): Promise<Result<void, ResetPasswordErrorCode>> {
  // 1. Validate password rules (D6)
  const passwordError = validatePassword(input.newPassword)
  if (passwordError) {
    return fail({
      error: AuthErrorCode.WEAK_PASSWORD,
      msg: passwordError,
    })
  }

  // 2. Consume verification proof (D8)
  const proofResult = await consumeVerificationProof(db, {
    verificationToken: input.verificationToken,
    expectedPurpose: "FORGET_PASSWORD",
  })

  if (!proofResult.success) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: proofResult.msg,
    })
  }

  const claims = proofResult.data

  // 3. Resolve user (from sub or identifier)
  let user = claims.sub ? (await findUserById(db, claims.sub))?.user : null
  if (!user) {
    const byIdentifier = await findUserByIdentifier(db, claims.identifier)
    user = byIdentifier?.user ?? null
  }

  if (!user) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "User not found for this verification token",
    })
  }

  // 4. Update password hash
  const newHash = await hashPassword(input.newPassword)
  await updateUserPassword(db, user.id, newHash)

  // 5. Revoke ALL sessions with reason password_reset (Slice 3, D4)
  await revokeAllSessionsForUser(db, user.id, "password_reset")

  // 6. Audit event
  const identifierHmac = computeIdentifierHmac(claims.identifier)
  await writeAuditEvent(db, {
    eventType: "auth.password_reset_completed",
    outcome: "success",
    subjectUserId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    identifierHmac,
  })

  // 7. Security notice (fire-and-forget side effect, AC-3)
  const fullUser = await findUserById(db, user.id)
  const noticeTarget =
    fullUser?.identifiers.find(
      (i) =>
        i.isPrimary &&
        (i.type === "email" || i.type === "phone") &&
        i.verifiedAt !== null
    ) ??
    fullUser?.identifiers.find(
      (i) => (i.type === "email" || i.type === "phone") && i.verifiedAt !== null
    )

  if (noticeTarget) {
    const sender = getMessageSender()
    scheduleBackground(async () => {
      await sender.sendSecurityNotice?.({
        to: noticeTarget.value,
        type: noticeTarget.type as "email" | "phone",
        event: "password_reset",
      })
    })
  }

  return ok({
    data: undefined,
    msg: "Password reset successfully",
  })
}
