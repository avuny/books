import { describe, it, expect } from "vitest"
import {
  classifyIdentifier,
  normalizeIdentifier,
  validateIdentifierForType,
  isEmailOrPhone,
  maskIdentifier,
} from "../../core/identifier.rules.js"

describe("identifier.rules", () => {
  describe("classifyIdentifier", () => {
    it("classifies valid emails as email", () => {
      expect(classifyIdentifier("user@example.com")).toBe("email")
      expect(classifyIdentifier("khaled.dev@sub.domain.org")).toBe("email")
    })

    it("classifies valid E.164 phone numbers as phone", () => {
      expect(classifyIdentifier("+15551234567")).toBe("phone")
      expect(classifyIdentifier("+201012345678")).toBe("phone")
    })

    it("classifies single-word strings as username", () => {
      expect(classifyIdentifier("khaled123")).toBe("username")
      expect(classifyIdentifier("john_doe")).toBe("username")
    })

    it("returns null for strings with spaces or invalid phone formatting", () => {
      expect(classifyIdentifier("john doe")).toBe(null)
      expect(classifyIdentifier("12345")).toBe("username") // not phone (no +), not email
      expect(classifyIdentifier("")).toBe(null)
    })
  })

  describe("normalizeIdentifier", () => {
    it("lowercases and trims emails and usernames", () => {
      expect(normalizeIdentifier("  User@Example.COM  ")).toBe("user@example.com")
      expect(normalizeIdentifier("  KhaledDev  ")).toBe("khaleddev")
    })

    it("trims phone numbers", () => {
      expect(normalizeIdentifier("  +201012345678  ")).toBe("+201012345678")
    })
  })

  describe("validateIdentifierForType", () => {
    it("validates email formatting", () => {
      expect(validateIdentifierForType("test@example.com", "email")).toBeNull()
      expect(validateIdentifierForType("invalid-email", "email")).toBe(
        "Invalid email address"
      )
    })

    it("validates E.164 phone formatting", () => {
      expect(validateIdentifierForType("+15551234567", "phone")).toBeNull()
      expect(validateIdentifierForType("01012345678", "phone")).toContain(
        "E.164"
      )
    })

    it("validates username rules (3-32 chars, no email/phone lookalike, no spaces)", () => {
      expect(validateIdentifierForType("usr", "username")).toBeNull()
      expect(validateIdentifierForType("ab", "username")).toBe(
        "Username must be at least 3 characters"
      )
      expect(
        validateIdentifierForType("a".repeat(33), "username")
      ).toBe("Username must be at most 32 characters")
      expect(
        validateIdentifierForType("test@example.com", "username")
      ).toBe("Username cannot look like an email")
      expect(
        validateIdentifierForType("+15551234567", "username")
      ).toBe("Username cannot look like a phone number")
    })
  })

  describe("isEmailOrPhone", () => {
    it("returns true for email and phone, false for username", () => {
      expect(isEmailOrPhone("email")).toBe(true)
      expect(isEmailOrPhone("phone")).toBe(true)
      expect(isEmailOrPhone("username")).toBe(false)
    })
  })

  describe("maskIdentifier (D13)", () => {
    it("masks emails safely without leaking local part", () => {
      expect(maskIdentifier("khaled@example.com", "email")).toBe(
        "k***@example.com"
      )
    })

    it("masks phone numbers safely", () => {
      expect(maskIdentifier("+201012345678", "phone")).toBe("+20********78")
    })

    it("masks usernames safely", () => {
      expect(maskIdentifier("developer", "username")).toBe("de******r")
    })
  })
})
