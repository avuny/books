import { describe, it, expect } from "vitest"
import { validatePassword } from "../../core/password.rules.js"

describe("password.rules (D6)", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePassword("1234567")).toContain("at least 8")
  })

  it("accepts valid passwords of 8 or more characters", () => {
    expect(validatePassword("strongPassword123")).toBeNull()
  })

  it("rejects passwords longer than 72 UTF-8 bytes to avoid bcrypt truncation", () => {
    // 73 ASCII characters = 73 bytes
    const longAscii = "a".repeat(73)
    expect(validatePassword(longAscii)).toContain("must not exceed 72 bytes")

    // Multi-byte UTF-8: '🔑' is 4 bytes
    const emojis = "🔑".repeat(19) // 19 * 4 = 76 bytes
    expect(validatePassword(emojis)).toContain("must not exceed 72 bytes")
  })

  it("accepts passwords up to exactly 72 UTF-8 bytes", () => {
    const exactly72 = "a".repeat(72)
    expect(validatePassword(exactly72)).toBeNull()
  })
})
