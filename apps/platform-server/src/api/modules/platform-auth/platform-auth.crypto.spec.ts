import { beforeAll, describe, expect, it } from "vitest"

/**
 * Unit tests for the platform auth cryptography (A1-04). The module reads its
 * secrets from config lazily, so the env is set before the dynamic import.
 */

let crypto: typeof import("./platform-auth.crypto.js")

beforeAll(async () => {
  process.env.PLATFORM_AUTH_TICKET_SECRET ??=
    "unit-ticket-secret-0123456789abcdef0123456789abcdef"
  process.env.PLATFORM_TOTP_ENC_KEY ??=
    "unit-totp-enc-key-0123456789abcdef0123456789abcdef"
  crypto = await import("./platform-auth.crypto.js")
})

describe("base32", () => {
  it("round-trips and matches the RFC 4648 vector", () => {
    // "12345678901234567890" in base32 (the RFC 6238 SHA-1 test secret).
    const bytes = new TextEncoder().encode("12345678901234567890")
    const encoded = crypto.base32Encode(bytes)
    expect(encoded).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
    expect(Array.from(crypto.base32Decode(encoded))).toEqual(Array.from(bytes))
  })
})

describe("totpCode / verifyTotp (RFC 6238 vectors, SHA-1)", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

  it("produces the 6-digit truncation of the RFC vectors", () => {
    // RFC 6238 appendix B, SHA-1, 8 digits: T=59 -> 94287082, T=1111111109 -> 07081804.
    expect(crypto.totpCode(secret, 0, 59_000)).toBe("287082")
    expect(crypto.totpCode(secret, 0, 1_111_111_109_000)).toBe("081804")
  })

  it("accepts the current step and ±1 step, rejects beyond the window", () => {
    const t = 1_234_567_890_000
    const current = crypto.totpCode(secret, 0, t)
    const prev = crypto.totpCode(secret, -1, t)
    const next = crypto.totpCode(secret, 1, t)
    const outside = crypto.totpCode(secret, 2, t)

    const realNow = Date.now
    Date.now = () => t
    try {
      expect(crypto.verifyTotp(secret, current)).toBe(true)
      expect(crypto.verifyTotp(secret, prev)).toBe(true)
      expect(crypto.verifyTotp(secret, next)).toBe(true)
      expect(crypto.verifyTotp(secret, outside)).toBe(false)
    } finally {
      Date.now = realNow
    }
  })

  it("rejects malformed codes", () => {
    expect(crypto.verifyTotp(secret, "12345")).toBe(false)
    expect(crypto.verifyTotp(secret, "abcdef")).toBe(false)
    expect(crypto.verifyTotp(secret, "")).toBe(false)
  })
})

describe("TOTP secret encryption at rest", () => {
  it("round-trips and never stores the plaintext", () => {
    const secret = crypto.generateTotpSecret()
    const enc = crypto.encryptTotpSecret(secret)
    expect(enc).not.toContain(secret)
    expect(crypto.decryptTotpSecret(enc)).toBe(secret)
  })

  it("fails on tampered ciphertext", () => {
    const enc = crypto.encryptTotpSecret("JBSWY3DPEHPK3PXP")
    const [iv, data] = enc.split(".")
    const bytes = Buffer.from(data!, "base64url")
    bytes[0] = bytes[0]! ^ 0xff
    const tampered = `${iv}.${Buffer.from(bytes).toString("base64url")}`
    expect(() => crypto.decryptTotpSecret(tampered)).toThrow()
  })
})

describe("signed tickets", () => {
  it("round-trips a login ticket", () => {
    const { token } = crypto.signTicket({ pur: "login", sub: "admin-1" })
    const payload = crypto.verifyTicket(token, "login")
    expect(payload?.sub).toBe("admin-1")
    expect(payload?.pur).toBe("login")
  })

  it("rejects the wrong purpose, tampering and expiry", () => {
    const { token } = crypto.signTicket({ pur: "login", sub: "admin-1" })
    expect(crypto.verifyTicket(token, "enroll")).toBeNull()
    expect(crypto.verifyTicket(`${token}x`, "login")).toBeNull()
    expect(crypto.verifyTicket(token.replace(/.$/, "A"), "login")).toBeNull()

    const { token: expired } = crypto.signTicket(
      { pur: "login", sub: "admin-1" },
      -1 // already expired
    )
    expect(crypto.verifyTicket(expired, "login")).toBeNull()
  })
})
