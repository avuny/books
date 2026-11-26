import { describe, expect, it } from "vitest"
import { otpPurposeLabel } from "./otp-purpose-label.js"

describe("otpPurposeLabel", () => {
  it("never returns a raw enum key", () => {
    for (const purpose of ["SIGN_UP", "ADD_IDENTIFIER", "UPDATE_IDENTIFIER", "FORGET_PASSWORD", "OTHER"]) {
      expect(otpPurposeLabel(purpose)).not.toMatch(/[A-Z]_[A-Z]|^[A-Z]+$/)
    }
  })
  it("words sign-up and password reset plainly", () => {
    expect(otpPurposeLabel("SIGN_UP")).toBe("sign-up")
    expect(otpPurposeLabel("FORGET_PASSWORD")).toBe("password reset")
  })
})
