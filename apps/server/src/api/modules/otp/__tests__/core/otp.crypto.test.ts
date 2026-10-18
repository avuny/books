import { describe, it, expect } from "vitest"
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpHash,
  signVerificationToken,
  verifyVerificationToken,
} from "../../core/otp.crypto.js"

describe("otp.crypto (D7, D8)", () => {
  it("generates a 6-digit numeric OTP code", () => {
    const code = generateOtpCode()
    expect(code).toHaveLength(6)
    expect(/^\d{6}$/.test(code)).toBe(true)
  })

  it("hashes OTP codes with HMAC-SHA256 and verifies correctly", () => {
    const challengeId = "test-challenge-id"
    const code = "123456"
    const hash = hashOtpCode(challengeId, code)

    expect(typeof hash).toBe("string")
    expect(hash.length).toBe(64) // hex SHA-256

    expect(verifyOtpHash(challengeId, code, hash)).toBe(true)
    expect(verifyOtpHash(challengeId, "654321", hash)).toBe(false)
    expect(verifyOtpHash("other-challenge-id", code, hash)).toBe(false)
  })

  it("signs and verifies verification proof JWTs (D8)", () => {
    const payload = {
      jti: "test-otp-id",
      purpose: "SIGN_UP",
      identifier: "test@example.com",
    }

    const { token, expiresAt } = signVerificationToken(payload)
    expect(token).toBeDefined()
    expect(expiresAt).toBeDefined()

    const verified = verifyVerificationToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.jti).toBe(payload.jti)
    expect(verified?.purpose).toBe(payload.purpose)
    expect(verified?.identifier).toBe(payload.identifier)
  })

  it("rejects tampered or malformed verification tokens", () => {
    expect(verifyVerificationToken("invalid.jwt.token")).toBeNull()
  })
})
