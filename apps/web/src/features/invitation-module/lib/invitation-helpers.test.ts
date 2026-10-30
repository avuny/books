import { describe, expect, it } from "vitest"

import {
  blankToUndefined,
  canResendInvitation,
  canRevokeInvitation,
  getInvitationContact,
  normalizePhone,
} from "./invitation-helpers"

describe("canResendInvitation / canRevokeInvitation", () => {
  it("only allow pending invitations", () => {
    expect(canResendInvitation({ status: "pending" })).toBe(true)
    expect(canRevokeInvitation({ status: "pending" })).toBe(true)

    for (const status of ["accepted", "declined", "revoked", "expired"] as const) {
      expect(canResendInvitation({ status })).toBe(false)
      expect(canRevokeInvitation({ status })).toBe(false)
    }
  })
})

describe("getInvitationContact", () => {
  it("prefers the contact of the chosen channel", () => {
    expect(
      getInvitationContact({ channel: "email", email: "a@b.co", phone: "+201001234567" })
    ).toBe("a@b.co")
    expect(
      getInvitationContact({ channel: "whatsapp", email: "a@b.co", phone: "+201001234567" })
    ).toBe("+201001234567")
  })

  it("falls back to the other contact, then to null", () => {
    expect(getInvitationContact({ channel: "whatsapp", email: "a@b.co", phone: null })).toBe(
      "a@b.co"
    )
    expect(getInvitationContact({ channel: "email", email: null, phone: null })).toBeNull()
  })
})

describe("normalizePhone", () => {
  it("strips spaces, dashes and parentheses", () => {
    expect(normalizePhone("+20 (100) 123-4567")).toBe("+201001234567")
    expect(normalizePhone("")).toBe("")
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
