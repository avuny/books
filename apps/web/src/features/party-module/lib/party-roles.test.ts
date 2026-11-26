import { describe, expect, it } from "vitest"
import {
  oppositeRole,
  isRoleActive,
  roleStatus,
  derivePartyAbilities,
} from "./party-roles.js"
import type { PartyRoleDto } from "../types.js"

const NOW = "2026-01-01T00:00:00.000Z"

describe("party-roles (WT-ROLES)", () => {
  it("oppositeRole swaps CUSTOMER and VENDOR", () => {
    expect(oppositeRole("CUSTOMER")).toBe("VENDOR")
    expect(oppositeRole("VENDOR")).toBe("CUSTOMER")
  })

  it("isRoleActive checks if the role is present and active", () => {
    const roles: PartyRoleDto[] = [
      { role: "CUSTOMER", isActive: true, createdAt: NOW, updatedAt: NOW },
      { role: "VENDOR", isActive: false, createdAt: NOW, updatedAt: NOW },
    ]
    expect(isRoleActive(roles, "CUSTOMER")).toBe(true)
    expect(isRoleActive(roles, "VENDOR")).toBe(false)
    expect(isRoleActive([], "CUSTOMER")).toBe(false)
  })

  it("roleStatus returns active, inactive, or missing", () => {
    const roles: PartyRoleDto[] = [
      { role: "CUSTOMER", isActive: true, createdAt: NOW, updatedAt: NOW },
      { role: "VENDOR", isActive: false, createdAt: NOW, updatedAt: NOW },
    ]
    expect(roleStatus(roles, "CUSTOMER")).toBe("active")
    expect(roleStatus(roles, "VENDOR")).toBe("inactive")
    expect(roleStatus([], "CUSTOMER")).toBe("missing")
  })

  it("derivePartyAbilities returns all false when snapshot is missing", () => {
    const abilities = derivePartyAbilities(undefined, "CUSTOMER")
    expect(abilities.canRead).toBe(false)
    expect(abilities.canCreate).toBe(false)
    expect(abilities.opposite.role).toBe("VENDOR")
    expect(abilities.opposite.canCreate).toBe(false)
  })

  it("derivePartyAbilities evaluates permissions for both roles", () => {
    const snapshot = {
      isOwner: false,
      statements: [
        { effect: "allow", resource: "customer", action: "read" },
        { effect: "allow", resource: "customer", action: "create" },
        { effect: "allow", resource: "vendor", action: "create" },
      ],
    }
    const abilities = derivePartyAbilities(snapshot, "CUSTOMER")
    expect(abilities.canRead).toBe(true)
    expect(abilities.canCreate).toBe(true)
    expect(abilities.canUpdate).toBe(false)
    expect(abilities.opposite.role).toBe("VENDOR")
    expect(abilities.opposite.canCreate).toBe(true)
    expect(abilities.opposite.canRead).toBe(false)
  })
})
