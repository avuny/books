import { describe, expect, it } from "vitest"
import {
  PARTY_AUDIT_EVENTS,
  PARTY_OPPOSITE_ROLE,
  PARTY_ROLES,
  PARTY_SALUTATIONS,
  PARTY_TYPES,
} from "./constants.js"
import { PartyErrorCode } from "./errors.js"
import { PERMISSION_CATALOG, type PermissionKey } from "../role/permission-catalog.js"
import type { ActivityLogAction } from "../activity-log/index.js"

describe("party constants (CT-ENUM)", () => {
  it("defines non-empty enums for types, salutations, and roles", () => {
    expect(PARTY_TYPES).toEqual(["PERSON", "ORGANIZATION"])
    expect(PARTY_SALUTATIONS.length).toBeGreaterThan(0)
    expect(PARTY_ROLES).toEqual(["CUSTOMER", "VENDOR"])
  })

  it("maps opposite role bi-directionally", () => {
    expect(PARTY_OPPOSITE_ROLE.CUSTOMER).toBe("VENDOR")
    expect(PARTY_OPPOSITE_ROLE.VENDOR).toBe("CUSTOMER")
  })

  it("defines party error codes where keys equal values", () => {
    expect(Object.keys(PartyErrorCode).length).toBe(7)
    for (const [key, value] of Object.entries(PartyErrorCode)) {
      expect(key).toBe(value)
    }
    expect(PartyErrorCode.PARTY_NOT_FOUND).toBe("PARTY_NOT_FOUND")
    expect(PartyErrorCode.PARTY_ROLE_NOT_FOUND).toBe("PARTY_ROLE_NOT_FOUND")
    expect(PartyErrorCode.PARTY_ROLE_ALREADY_ACTIVE).toBe("PARTY_ROLE_ALREADY_ACTIVE")
    expect(PartyErrorCode.PARTY_ROLE_INACTIVE).toBe("PARTY_ROLE_INACTIVE")
    expect(PartyErrorCode.PARTY_CONTACT_NOT_FOUND).toBe("PARTY_CONTACT_NOT_FOUND")
    expect(PartyErrorCode.PARTY_EMAIL_ALREADY_EXISTS).toBe("PARTY_EMAIL_ALREADY_EXISTS")
    expect(PartyErrorCode.PARTY_SALUTATION_NOT_ALLOWED).toBe("PARTY_SALUTATION_NOT_ALLOWED")
  })

  it("registers customer and vendor in permission catalog and audit events", () => {
    const customerEntry = PERMISSION_CATALOG.find((e) => e.resource === "customer")
    const vendorEntry = PERMISSION_CATALOG.find((e) => e.resource === "vendor")
    expect(customerEntry).toBeDefined()
    expect(vendorEntry).toBeDefined()
    expect(customerEntry?.actions).toEqual(["create", "read", "update", "delete"])
    expect(vendorEntry?.actions).toEqual(["create", "read", "update", "delete"])

    // Test that the 8 permission keys typecheck
    const keys: PermissionKey[] = [
      "create:customer",
      "read:customer",
      "update:customer",
      "delete:customer",
      "create:vendor",
      "read:vendor",
      "update:vendor",
      "delete:vendor",
    ]
    expect(keys.length).toBe(8)

    // Test that the 8 audit events match ActivityLogAction
    const events: ActivityLogAction[] = [
      PARTY_AUDIT_EVENTS.CUSTOMER_CREATED,
      PARTY_AUDIT_EVENTS.CUSTOMER_UPDATED,
      PARTY_AUDIT_EVENTS.CUSTOMER_DEACTIVATED,
      PARTY_AUDIT_EVENTS.CUSTOMER_REACTIVATED,
      PARTY_AUDIT_EVENTS.VENDOR_CREATED,
      PARTY_AUDIT_EVENTS.VENDOR_UPDATED,
      PARTY_AUDIT_EVENTS.VENDOR_DEACTIVATED,
      PARTY_AUDIT_EVENTS.VENDOR_REACTIVATED,
    ]
    expect(events.length).toBe(8)
  })
})
