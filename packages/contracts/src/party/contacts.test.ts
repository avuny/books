import { describe, expect, it } from "vitest"
import {
  countPrimaries,
  emailKey,
  findDuplicateEmailIndexes,
  findDuplicateIds,
  hasExactlyOnePrimary,
} from "./contacts.js"

describe("party contact helpers (CT-HELPERS)", () => {
  it("emailKey trims and lowercases email", () => {
    expect(emailKey("  User@Example.COM  ")).toBe("user@example.com")
  })

  it("findDuplicateEmailIndexes detects case-insensitive duplicates", () => {
    const list = [
      { email: "a@test.com" },
      { email: "b@test.com" },
      { email: "A@test.com" },
      { email: "c@test.com" },
      { email: "  B@test.com " },
    ]
    expect(findDuplicateEmailIndexes(list)).toEqual([2, 4])
  })

  it("countPrimaries and hasExactlyOnePrimary handle empty and primary collections correctly", () => {
    expect(countPrimaries([])).toBe(0)
    expect(hasExactlyOnePrimary([])).toBe(true)

    expect(countPrimaries([{ isPrimary: false }, { isPrimary: false }])).toBe(0)
    expect(hasExactlyOnePrimary([{ isPrimary: false }, { isPrimary: false }])).toBe(false)

    expect(countPrimaries([{ isPrimary: true }, { isPrimary: false }])).toBe(1)
    expect(hasExactlyOnePrimary([{ isPrimary: true }, { isPrimary: false }])).toBe(true)

    expect(countPrimaries([{ isPrimary: true }, { isPrimary: true }])).toBe(2)
    expect(hasExactlyOnePrimary([{ isPrimary: true }, { isPrimary: true }])).toBe(false)
  })

  it("findDuplicateIds identifies duplicate non-empty ids", () => {
    const list = [
      { id: "id-1" },
      { id: "id-2" },
      { id: "id-1" },
      { id: undefined },
      { id: null },
      { id: "id-2" },
    ]
    expect(findDuplicateIds(list).sort()).toEqual(["id-1", "id-2"].sort())
  })
})
