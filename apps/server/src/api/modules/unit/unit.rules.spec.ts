import { describe, expect, it } from "vitest"
import { checkCanDeleteUnit, checkCanModifyUnit, checkUniqueness } from "./unit.rules.js"

describe("unit rules", () => {
  it("checkCanModifyUnit: blocks modifying system units (orgId === null)", () => {
    expect(checkCanModifyUnit({ orgId: null })?.error).toBe("UNIT_SYSTEM_IMMUTABLE")
    expect(checkCanModifyUnit({ orgId: "org-1" })).toBeNull()
  })

  it("checkCanDeleteUnit: blocks deleting system units or units in use", () => {
    expect(checkCanDeleteUnit({ orgId: null }, false)?.error).toBe("UNIT_SYSTEM_IMMUTABLE")
    expect(checkCanDeleteUnit({ orgId: "org-1" }, true)?.error).toBe("UNIT_IN_USE")
    expect(checkCanDeleteUnit({ orgId: "org-1" }, false)).toBeNull()
  })

  it("checkUniqueness: detects name or symbol collision", () => {
    const existing = [
      { id: "1", name: "Kilogram", symbol: "kg" },
      { id: "2", name: "Meter", symbol: "m" },
    ]

    expect(checkUniqueness({ name: "kilogram" }, existing).ok).toBe(false)
    expect(checkUniqueness({ symbol: "kg" }, existing).ok).toBe(false)
    expect(checkUniqueness({ name: "Gram", symbol: "g" }, existing).ok).toBe(true)

    // Current unit id ignored for self-updates:
    expect(checkUniqueness({ name: "Kilogram", symbol: "kg" }, existing, "1").ok).toBe(true)
  })
})
