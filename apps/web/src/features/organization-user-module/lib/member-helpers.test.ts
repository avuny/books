import { describe, expect, it } from "vitest"

import {
  canEditMember,
  canToggleMemberStatus,
  canTransferOwnershipTo,
  getMemberStatus,
} from "./member-helpers"

describe("getMemberStatus", () => {
  it("maps isActive to a status", () => {
    expect(getMemberStatus({ isActive: true })).toBe("active")
    expect(getMemberStatus({ isActive: false })).toBe("inactive")
  })
})

describe("canEditMember / canToggleMemberStatus", () => {
  it("never offer actions for the owner", () => {
    expect(canEditMember({ type: "owner" })).toBe(false)
    expect(canToggleMemberStatus({ type: "owner" })).toBe(false)
  })

  it("allow managed and portal members", () => {
    for (const type of ["managed", "portal"] as const) {
      expect(canEditMember({ type })).toBe(true)
      expect(canToggleMemberStatus({ type })).toBe(true)
    }
  })
})

describe("canTransferOwnershipTo", () => {
  it("only allows an active managed member", () => {
    expect(canTransferOwnershipTo({ type: "managed", isActive: true })).toBe(
      true
    )
    expect(canTransferOwnershipTo({ type: "managed", isActive: false })).toBe(
      false
    )
    expect(canTransferOwnershipTo({ type: "portal", isActive: true })).toBe(
      false
    )
    expect(canTransferOwnershipTo({ type: "owner", isActive: true })).toBe(
      false
    )
  })
})
