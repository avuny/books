import crypto from "node:crypto"
import { ok, fail, type Result } from "@avuny/utils"
import type { Database } from "@avuny/db"
import type { OtpPurpose } from "@avuny/db"
import { OtpErrorCode } from "@avuny/contracts"
import { config } from "../../../config.js"
import { writeAuditEvent, computeIdentifierHmac } from "../../audit/index.js"
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpHash,
  signVerificationToken,
  verifyVerificationToken,
  type VerificationTokenPayload,
} from "../core/otp.crypto.js"
import {
  findOtpById,
  getMostRecentOtp,
  countSendsSince,
  countSendsForIpSince,
  closePendingOtps,
  insertOtp,
  incrementAttempts,
  markConsumed,
  markVerified,
  consumeOtpProof,
} from "./otp.repo.js"

export interface IssueOtpInput {
  purpose: OtpPurpose
  identifier: string // normalized
  userId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
  isSuppressed?: boolean
}

export interface IssueOtpData {
  challengeId: string
  expiresAt: string
  resendAvailableAt: string
  code: string
}

export type IssueOtpErrorCode =
  | typeof OtpErrorCode.OTP_RATE_LIMITED
  | typeof OtpErrorCode.OTP_RESEND_TOO_SOON
  | typeof OtpErrorCode.OTP_INVALID

export type VerifyOtpErrorCode =
  | typeof OtpErrorCode.OTP_INVALID
  | typeof OtpErrorCode.OTP_EXPIRED
  | typeof OtpErrorCode.OTP_ATTEMPTS_EXCEEDED
  | typeof OtpErrorCode.VERIFICATION_TOKEN_INVALID

export async function issueOtp(
  db: Database,
  input: IssueOtpInput
): Promise<Result<IssueOtpData, IssueOtpErrorCode>> {
  const now = Date.now()

  // 1. IP rate limit check (D10): max OTP_MAX_SENDS_PER_IP_PER_HOUR in past hour
  if (input.ipAddress) {
    const oneHourAgo = new Date(now - 3600 * 1000)
    const ipSends = await countSendsForIpSince(db, input.ipAddress, oneHourAgo)
    if (ipSends >= config.OTP_MAX_SENDS_PER_IP_PER_HOUR) {
      return fail({
        error: OtpErrorCode.OTP_RATE_LIMITED,
        msg: "IP rate limit exceeded",
        meta: { ip: input.ipAddress },
      })
    }
  }

  // 2. Cooldown check (D7): 60s cooldown per identifier & purpose
  const recent = await getMostRecentOtp(db, input.identifier, input.purpose)
  if (recent) {
    const elapsedSeconds = Math.floor((now - recent.createdAt.getTime()) / 1000)
    if (elapsedSeconds < config.OTP_RESEND_COOLDOWN) {
      return fail({
        error: OtpErrorCode.OTP_RESEND_TOO_SOON,
        msg: "Resend cooldown active",
        meta: { retryAfter: config.OTP_RESEND_COOLDOWN - elapsedSeconds },
      })
    }
  }

  // 3. Identifier hourly send limit check (D7): max OTP_MAX_SENDS_PER_HOUR
  const oneHourAgo = new Date(now - 3600 * 1000)
  const identifierSends = await countSendsSince(
    db,
    input.identifier,
    input.purpose,
    oneHourAgo
  )
  if (identifierSends >= config.OTP_MAX_SENDS_PER_HOUR) {
    return fail({
      error: OtpErrorCode.OTP_RATE_LIMITED,
      msg: "Hourly send limit reached for identifier",
      meta: { identifier: input.identifier },
    })
  }

  // 4. Generate code and hash
  const challengeId = crypto.randomUUID()
  const code = generateOtpCode()
  const otpHash = hashOtpCode(challengeId, code)
  const expiresAt = new Date(now + config.OTP_TTL * 1000)
  const resendAvailableAt = new Date(now + config.OTP_RESEND_COOLDOWN * 1000)

  // 5. In a transaction, close any pending OTP and insert the new row, and record audit event (D7, D10)
  await db.transaction(async (tx) => {
    await closePendingOtps(tx, input.identifier, input.purpose)

    await insertOtp(tx, {
      id: challengeId,
      purpose: input.purpose,
      identifier: input.identifier,
      userId: input.userId,
      otpHash,
      expiresAt,
    })

    const identifierHmac = computeIdentifierHmac(input.identifier)
    await writeAuditEvent(tx, {
      eventType: "otp.sent",
      outcome: "success",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      identifierHmac,
      subjectUserId: input.userId,
      metadata: {
        purpose: input.purpose,
        suppressed: input.isSuppressed ?? false,
      },
    })
  })

  return ok({
    data: {
      challengeId,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      code,
    },
    msg: "OTP issued successfully",
  })
}

export interface VerifyOtpInput {
  challengeId: string
  code: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export interface VerifyOtpData {
  verificationToken: string
  expiresAt: string
}

export async function verifyOtp(
  db: Database,
  input: VerifyOtpInput
): Promise<Result<VerifyOtpData, VerifyOtpErrorCode>> {
  const row = await findOtpById(db, input.challengeId)
  if (!row) {
    return fail({
      error: OtpErrorCode.OTP_INVALID,
      msg: "Challenge not found",
    })
  }

  // If already consumed, invalid/expired
  if (row.consumedAt) {
    return fail({
      error: OtpErrorCode.OTP_EXPIRED,
      msg: "OTP already consumed",
    })
  }

  // If code entry expired
  if (row.expiresAt.getTime() < Date.now()) {
    return fail({
      error: OtpErrorCode.OTP_EXPIRED,
      msg: "OTP code expired",
    })
  }

  // Atomically increment attempts
  const attempts = await incrementAttempts(db, row.id)
  if (attempts > config.OTP_MAX_ATTEMPTS) {
    await markConsumed(db, row.id)
    return fail({
      error: OtpErrorCode.OTP_ATTEMPTS_EXCEEDED,
      msg: "Maximum OTP verification attempts exceeded",
    })
  }

  // Verify hash
  const isValid = verifyOtpHash(row.id, input.code, row.otpHash)
  if (!isValid) {
    const identifierHmac = computeIdentifierHmac(row.identifier)
    await writeAuditEvent(db, {
      eventType: "otp.verify_failed",
      outcome: "failure",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      identifierHmac,
      subjectUserId: row.userId ?? undefined,
      metadata: {
        purpose: row.purpose,
        attempts,
      },
    })

    if (attempts >= config.OTP_MAX_ATTEMPTS) {
      await markConsumed(db, row.id)
      return fail({
        error: OtpErrorCode.OTP_ATTEMPTS_EXCEEDED,
        msg: "Maximum OTP verification attempts exceeded",
      })
    }

    return fail({
      error: OtpErrorCode.OTP_INVALID,
      msg: "Incorrect OTP code",
    })
  }

  // Mark verified
  await markVerified(db, row.id)

  // Issue verification proof JWT (D8)
  const tokenPayload: VerificationTokenPayload = {
    jti: row.id,
    purpose: row.purpose,
    identifier: row.identifier,
    sub: row.userId ?? undefined,
  }

  const { token, expiresAt } = signVerificationToken(tokenPayload)

  return ok({
    data: {
      verificationToken: token,
      expiresAt,
    },
    msg: "OTP verified successfully",
  })
}

export interface ConsumeVerificationProofInput {
  verificationToken: string
  expectedPurpose: OtpPurpose
  expectedIdentifier?: string
  expectedUserId?: string
}

export async function consumeVerificationProof(
  db: Database,
  input: ConsumeVerificationProofInput
): Promise<Result<VerificationTokenPayload, OtpErrorCode>> {
  const claims = verifyVerificationToken(input.verificationToken)
  if (!claims) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "Verification token is invalid or expired",
    })
  }

  if (claims.purpose !== input.expectedPurpose) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "Verification token purpose mismatch",
    })
  }

  if (input.expectedIdentifier && claims.identifier !== input.expectedIdentifier) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "Verification token identifier mismatch",
    })
  }

  if (input.expectedUserId && claims.sub !== input.expectedUserId) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "Verification token user mismatch",
    })
  }

  // Consume in the database atomically (D8)
  const consumed = await consumeOtpProof(
    db,
    claims.jti,
    input.expectedPurpose,
    claims.identifier,
    input.expectedUserId
  )

  if (!consumed) {
    return fail({
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "Verification proof already consumed or not verified",
    })
  }

  return ok({
    data: claims,
    msg: "Verification proof consumed successfully",
  })
}
