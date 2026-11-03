import { describe, expect, it } from "vitest"

import { canTransferOwnershipTo, getMemberStatus } from "./member-helpers"

describe("getMemberStatus", () => {
  it("maps isActive to a status", () => {
    expect(getMemberStatus({ isActive: true })).toBe("active")
    expect(getMemberStatus({ isActive: false })).toBe("inactive")
  })
})

describe("canTransferOwnershipTo", () => {
  it("only allows an active member", () => {
    expect(canTransferOwnershipTo({ isActive: true })).toBe(true)
    expect(canTransferOwnershipTo({ isActive: false })).toBe(false)
  })
})
