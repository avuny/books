import bcrypt from "bcryptjs"
import { describe, expect, it } from "vitest"
import { needsRehash, verifyPassword } from "../../shell/users.crypto.js"

describe("needsRehash", () => {
  it("flags hashes with more rounds than configured", () => {
    expect(needsRehash("$2a$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234", 10)).toBe(true)
  })
  it("does not flag equal or lower rounds", () => {
    expect(needsRehash("$2a$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234", 10)).toBe(false)
    expect(needsRehash("$2b$04$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234", 10)).toBe(false)
  })
  it("ignores values that are not bcrypt hashes", () => {
    expect(needsRehash("not-a-hash", 10)).toBe(false)
  })
  it("old higher-cost hashes still verify", async () => {
    const old = await bcrypt.hash("pw-12345678", 6)
    expect(await verifyPassword("pw-12345678", old)).toBe(true)
  })
})
