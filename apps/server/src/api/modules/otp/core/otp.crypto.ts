import crypto from "node:crypto"
import jwt from "jsonwebtoken"
import { config } from "../../../config.js"
import { OTP_CODE_LENGTH } from "@avuny/contracts"

/**
 * Generate a cryptographically secure random numeric OTP code of length OTP_CODE_LENGTH (6 digits).
 */
export function generateOtpCode(): string {
  const min = Math.pow(10, OTP_CODE_LENGTH - 1)
  const max = Math.pow(10, OTP_CODE_LENGTH)
  return crypto.randomInt(min, max).toString()
}

/**
 * Hash an OTP code for storage (D7):
 * hex HMAC-SHA256 of (challengeId + code) with OTP_SECRET.
 */
export function hashOtpCode(challengeId: string, code: string): string {
  return crypto
    .createHmac("sha256", config.OTP_SECRET)
    .update(`${challengeId}:${code}`)
    .digest("hex")
}

/**
 * Constant-time comparison between stored OTP hash and calculated hash.
 */
export function verifyOtpHash(
  challengeId: string,
  code: string,
  storedHash: string
): boolean {
  const calculatedHash = hashOtpCode(challengeId, code)
  if (calculatedHash.length !== storedHash.length) return false
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash, "hex"),
    Buffer.from(storedHash, "hex")
  )
}

export interface VerificationTokenPayload {
  jti: string
  purpose: string
  identifier: string
  sub?: string
}

/**
 * Issue a verification proof JWT (D8).
 * Signed with VERIFICATION_TOKEN_SECRET, valid for VERIFICATION_TOKEN_TTL (15 min).
 */
export function signVerificationToken(payload: VerificationTokenPayload): {
  token: string
  expiresAt: string
} {
  const expiresInSeconds = config.VERIFICATION_TOKEN_TTL
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

  const token = jwt.sign(payload, config.VERIFICATION_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
  })

  return { token, expiresAt }
}

/**
 * Verify and decode a verification proof JWT (D8).
 * Returns the verified payload or null if invalid or expired.
 */
export function verifyVerificationToken(
  token: string
): VerificationTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.VERIFICATION_TOKEN_SECRET, {
      algorithms: ["HS256"],
    }) as VerificationTokenPayload & jwt.JwtPayload

    if (!decoded.jti || !decoded.purpose || !decoded.identifier) {
      return null
    }

    return {
      jti: decoded.jti,
      purpose: decoded.purpose,
      identifier: decoded.identifier,
      sub: decoded.sub,
    }
  } catch {
    return null
  }
}
