import { describe, it, expect } from "vitest"
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../../core/auth.crypto.js"

describe("auth.crypto (D3, D4)", () => {
  it("signs and verifies access token JWTs containing sub and sid", () => {
    const payload = {
      sub: "user-uuid-123",
      sid: "session-uuid-456",
    }

    const { accessToken, accessTokenExpiresAt } = signAccessToken(payload)
    expect(accessToken).toBeDefined()
    expect(accessTokenExpiresAt).toBeDefined()

    const verified = verifyAccessToken(accessToken)
    expect(verified).not.toBeNull()
    expect(verified?.sub).toBe(payload.sub)
    expect(verified?.sid).toBe(payload.sid)
  })

  it("rejects invalid or tampered access tokens", () => {
    expect(verifyAccessToken("invalid-access-token")).toBeNull()
  })

  it("generates opaque 32-byte base64url refresh tokens (D4)", () => {
    const token1 = generateRefreshToken()
    const token2 = generateRefreshToken()

    expect(typeof token1).toBe("string")
    expect(token1.length).toBeGreaterThanOrEqual(40) // 32 bytes in base64url is 43 chars
    expect(token1).not.toBe(token2)
  })

  it("hashes refresh tokens to lowercase hex SHA-256 (D4)", () => {
    const token = "sample-token-abc"
    const hash = hashRefreshToken(token)

    expect(hash).toHaveLength(64)
    expect(hash).toBe(hash.toLowerCase())
    // Deterministic
    expect(hashRefreshToken(token)).toBe(hash)
  })
})
