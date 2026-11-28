import { describe, expect, it } from "vitest"

import { MODULES } from "./registry.js"
import { MODULE_CATALOG } from "./catalog.js"
import { PRODUCT_MODULES, type ProductModuleKey } from "./product-modules.js"

/**
 * S1-01 done-when: the catalog type-checks and lists every registry module
 * under exactly one product module. S1-02 adds the server-side import-scan
 * test (apps/server/src/api/modules/module-deps.test.ts), which checks the
 * declared graph against the real imports between api/modules dirs.
 */

describe("MODULE_CATALOG (S1-01)", () => {
  it("lists every registry module under exactly one product module", () => {
    const assigned = Object.values(MODULE_CATALOG).flatMap((entry) => entry.modules)
    expect(new Set(assigned).size).toBe(assigned.length)
    expect([...assigned].sort()).toEqual(Object.keys(MODULES).sort())
  })

  it("has no empty product module without a planned-modules note", () => {
    for (const [key, entry] of Object.entries(MODULE_CATALOG)) {
      if (entry.modules.length === 0) {
        expect(
          entry.plannedModules?.length,
          `product module ${key} is empty and unplanned`
        ).toBeGreaterThan(0)
      }
    }
  })

  it("every dependency is a real product module", () => {
    for (const [key, spec] of Object.entries(PRODUCT_MODULES)) {
      for (const dep of spec.dependsOn) {
        expect(
          dep in PRODUCT_MODULES,
          `${key} depends on unknown product module ${dep}`
        ).toBe(true)
      }
    }
  })

  it("the dependency graph is acyclic", () => {
    const visiting = new Set<ProductModuleKey>()
    const done = new Set<ProductModuleKey>()
    const visit = (key: ProductModuleKey, path: string[]) => {
      expect(
        visiting.has(key),
        `dependency cycle: ${[...path, key].join(" -> ")}`
      ).toBe(false)
      if (done.has(key)) return
      visiting.add(key)
      for (const dep of PRODUCT_MODULES[key].dependsOn) {
        visit(dep, [...path, key])
      }
      visiting.delete(key)
      done.add(key)
    }
    for (const key of Object.keys(PRODUCT_MODULES) as ProductModuleKey[]) {
      visit(key, [])
    }
  })

  it("core is always on and never switchable (SPEC 2.4)", () => {
    expect(MODULE_CATALOG.core.switchable).toBe(false)
    expect(MODULE_CATALOG.core.defaultOn).toBe(true)
    expect(MODULE_CATALOG.core.showLocked).toBe(false)
  })

  it("inventory is on by default for new organizations (Q7)", () => {
    expect(MODULE_CATALOG.inventory.defaultOn).toBe(true)
    expect(MODULE_CATALOG.inventory.switchable).toBe(true)
  })

  it("catalog entries are a copy, not a view into PRODUCT_MODULES", () => {
    expect(MODULE_CATALOG.core.dependsOn).not.toBe(PRODUCT_MODULES.core.dependsOn)
  })
})
