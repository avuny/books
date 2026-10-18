import crypto from "node:crypto"
import jwt from "jsonwebtoken"
import { config } from "../../../config.js"

export interface AccessTokenPayload {
  sub: string // userId
  sid: string // sessionId
}

/**
 * Sign an access token JWT (D3).
 * HS256, contains sub (userId) and sid (sessionId).
 */
export function signAccessToken(payload: AccessTokenPayload): {
  accessToken: string
  accessTokenExpiresAt: string
} {
  const expiresInSeconds = config.ACCESS_TOKEN_TTL
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

  const accessToken = jwt.sign(payload, config.ACCESS_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
  })

  return { accessToken, accessTokenExpiresAt: expiresAt }
}

/**
 * Verify and decode an access token JWT (D3).
 * Returns payload if valid, null if expired or invalid.
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.ACCESS_TOKEN_SECRET, {
      algorithms: ["HS256"],
    }) as AccessTokenPayload & jwt.JwtPayload

    if (!decoded.sub || !decoded.sid) {
      return null
    }

    return {
      sub: decoded.sub,
      sid: decoded.sid,
    }
  } catch {
    return null
  }
}

/**
 * Generates an opaque high-entropy 32-byte refresh token (base64url) (D4).
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

/**
 * Hashes a refresh token for storage and lookup (D4).
 * Lowercase hex SHA-256.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
