import { describe, expect, it } from "vitest"

import {
  blankToUndefined,
  canResendInvitation,
  canRevokeInvitation,
  getInvitationContact,
} from "./invitation-helpers"

describe("canResendInvitation / canRevokeInvitation", () => {
  it("only allow pending invitations", () => {
    expect(canResendInvitation({ status: "pending" })).toBe(true)
    expect(canRevokeInvitation({ status: "pending" })).toBe(true)

    for (const status of [
      "accepted",
      "declined",
      "revoked",
      "expired",
    ] as const) {
      expect(canResendInvitation({ status })).toBe(false)
      expect(canRevokeInvitation({ status })).toBe(false)
    }
  })
})

describe("getInvitationContact", () => {
  it("returns the invitation identifier", () => {
    expect(getInvitationContact({ identifier: "a@b.co" })).toBe("a@b.co")
  })
})

describe("blankToUndefined", () => {
  it("turns empty and whitespace-only strings into undefined", () => {
    expect(blankToUndefined("")).toBeUndefined()
    expect(blankToUndefined("   ")).toBeUndefined()
    expect(blankToUndefined(undefined)).toBeUndefined()
    expect(blankToUndefined("  sam ")).toBe("sam")
  })
})
