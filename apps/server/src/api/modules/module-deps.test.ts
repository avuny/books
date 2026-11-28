import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  MODULES,
  PRODUCT_MODULES,
  type ProductModuleKey,
} from "@avuny/contracts/modules"
import type { ModuleKey } from "@avuny/contracts/modules"
import { describe, expect, it } from "vitest"

/**
 * S1-02: the product-module dependency graph in PRODUCT_MODULES is checked
 * against the real import graph of apps/server/src/api/modules.
 *
 * Method: walk every module dir, resolve each relative import, and record an
 * edge dir -> dir when one module's runtime code imports another's. Test
 * files (__tests__/, *.test.ts) are excluded: test-only imports are not
 * product coupling. Dirs map to product modules through the contracts
 * registry (kebab-case dir = snake_case registry key), with documented
 * overrides below for dirs that have no registry module.
 *
 * Rules the graph must hold:
 *  1. Every dir is classified: infrastructure, an override, or a registry
 *     module. A new unclassified dir fails here until someone places it.
 *  2. Edges into `core` need no declaration: core is always on and never
 *     switchable, so every module may use identity, roles and audit.
 *  3. Every other cross-product edge must be declared in the source
 *     module's dependsOn (hard) or softDependsOn (soft), so the commercial
 *     catalog can never drift from the code.
 */

const MODULES_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * Request pipeline and platform plumbing: not product modules. `users` is
 * cross-tenant identity, not the tenant-facing registry modules.
 */
const INFRA_DIRS = new Set([
  "admin",
  "audit",
  "auth",
  "geo",
  "messaging",
  "otp",
  "shared",
  "sidebar",
  "users",
])

/** Dirs whose product home the registry cannot say yet. */
const DIR_PRODUCT_OVERRIDES: Record<string, readonly ProductModuleKey[]> = {
  // Server code exists ahead of its registry module (plannedModules in
  // PRODUCT_MODULES, SPEC 2.4).
  "inventory-costing": ["inventory_costing"],
  // Projected-stock helper used by purchasing documents; no registry
  // module yet. Conceptually inventory: projected on-hand is stock state.
  "inventory-projection": ["inventory"],
  // Customers and vendors share tables (SPEC 2.4): the dir serves both the
  // sales and the purchasing product modules.
  party: ["sales", "purchasing"],
}

const dirProducts = (dir: string): readonly ProductModuleKey[] => {
  const override = DIR_PRODUCT_OVERRIDES[dir]
  if (override) return override
  const spec = MODULES[dir.replaceAll("-", "_") as ModuleKey]
  return spec ? [spec.product] : []
}

const listTsFiles = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue
      out.push(...listTsFiles(full))
    } else if (/\.ts$/.test(entry) && !/\.(test|spec|d)\.ts$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const IMPORT_RE =
  /(?:import|export)[^"';]*from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g

/** Module dirs (top level under api/modules) a file imports, itself excluded. */
const importedDirs = (file: string, ownDir: string): Set<string> => {
  const dirs = new Set<string>()
  for (const match of readFileSync(file, "utf8").matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2]
    if (!specifier?.startsWith(".")) continue
    const rel = path.relative(
      MODULES_DIR,
      path.resolve(path.dirname(file), specifier)
    )
    if (rel.startsWith("..")) continue // escapes api/modules (db.js, intl, ...)
    const top = rel.split(path.sep)[0]
    if (top && top !== ownDir) dirs.add(top)
  }
  return dirs
}

const moduleDirs = (): string[] =>
  readdirSync(MODULES_DIR).filter((entry) =>
    statSync(path.join(MODULES_DIR, entry)).isDirectory()
  )

const declaredTargets = (key: ProductModuleKey): Set<ProductModuleKey> =>
  new Set([
    ...PRODUCT_MODULES[key].dependsOn,
    ...(PRODUCT_MODULES[key].softDependsOn ?? []).map((s) => s.module),
  ])

describe("product module dependency graph vs import scan (S1-02)", () => {
  it("classifies every server module dir", () => {
    const unclassified = moduleDirs().filter(
      (dir) => !INFRA_DIRS.has(dir) && dirProducts(dir).length === 0
    )
    expect(
      unclassified,
      `unclassified module dirs: ${unclassified.join(", ")} - register the ` +
        "module in the contracts registry, add a DIR_PRODUCT_OVERRIDES entry, " +
        "or mark it INFRA_DIRS"
    ).toEqual([])
  })

  it("has every cross-product import edge declared in PRODUCT_MODULES", () => {
    const missing: string[] = []
    for (const sourceDir of moduleDirs()) {
      if (INFRA_DIRS.has(sourceDir)) continue
      const sources = dirProducts(sourceDir)
      const targets = new Set<string>()
      for (const file of listTsFiles(path.join(MODULES_DIR, sourceDir))) {
        for (const dir of importedDirs(file, sourceDir)) targets.add(dir)
      }
      for (const targetDir of targets) {
        if (INFRA_DIRS.has(targetDir)) continue
        const targetProducts = dirProducts(targetDir)
        // Edges into core are always allowed: core is on for everyone.
        if (targetProducts.every((p) => p === "core")) continue
        for (const source of sources) {
          for (const target of targetProducts) {
            if (source === target) continue
            if (sources.includes(target) || targetProducts.includes(source)) {
              continue // shared dir (party): the edge can be intra-product
            }
            if (!declaredTargets(source).has(target)) {
              missing.push(
                `${sourceDir} imports ${targetDir}: ${source} -> ${target} ` +
                  "is in neither dependsOn nor softDependsOn"
              )
            }
          }
        }
      }
    }
    expect(missing).toEqual([])
  })

  it("declared dependencies are real product modules with reasons on soft edges", () => {
    for (const [key, spec] of Object.entries(PRODUCT_MODULES)) {
      for (const dep of spec.dependsOn) {
        expect(
          dep in PRODUCT_MODULES,
          `${key} depends on unknown product module ${dep}`
        ).toBe(true)
      }
      for (const soft of spec.softDependsOn ?? []) {
        expect(
          soft.module in PRODUCT_MODULES,
          `${key} softly depends on unknown product module ${soft.module}`
        ).toBe(true)
        expect(
          soft.reason.length,
          `${key} -> ${soft.module} soft dependency needs a reason`
        ).toBeGreaterThan(0)
      }
    }
  })

  it("the hard dependency graph is acyclic (soft edges may point back up)", () => {
    const visiting = new Set<ProductModuleKey>()
    const done = new Set<ProductModuleKey>()
    const visit = (key: ProductModuleKey, trail: string[]) => {
      expect(
        visiting.has(key),
        `dependency cycle: ${[...trail, key].join(" -> ")}`
      ).toBe(false)
      if (done.has(key)) return
      visiting.add(key)
      for (const dep of PRODUCT_MODULES[key].dependsOn) {
        visit(dep, [...trail, key])
      }
      visiting.delete(key)
      done.add(key)
    }
    for (const key of Object.keys(PRODUCT_MODULES) as ProductModuleKey[]) {
      visit(key, [])
    }
  })
})
