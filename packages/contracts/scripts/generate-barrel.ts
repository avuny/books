/**
 * generate-barrel.ts  (packages/contracts)
 *
 * Auto-generates two things whenever a module folder is added/removed:
 *
 *  1. src/index.ts  — re-exports every public module's index.js
 *  2. package.json  — keeps the "exports" map in sync, with the
 *                     correct condition order: types → import → default
 *
 * A module is any sub-directory of src/ that:
 *   - is NOT listed in EXCLUDED_DIRS_BARREL  (barrel exclusions)
 *   - is NOT listed in EXCLUDED_DIRS_EXPORTS (exports exclusions)
 *   - contains an index.ts file
 *
 * Usage:
 *   tsx ./scripts/generate-barrel.ts
 *   tsx ./scripts/generate-barrel.ts --watch
 */

import {
  readdirSync,
  statSync,
  existsSync,
  writeFileSync,
  readFileSync,
  watch,
} from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const srcDir = resolve(__dirname, "../src")
const barrelPath = resolve(__dirname, "../src/index.ts")
const pkgPath = resolve(__dirname, "../package.json")

// ---------------------------------------------------------------------------
// Exclusion lists
// ---------------------------------------------------------------------------

/**
 * Dirs skipped from src/index.ts re-exports only.
 * "errors" is an internal utility — not a public barrel export.
 */
const EXCLUDED_DIRS_BARREL = new Set(["errors"])

/**
 * Dirs skipped from package.json exports entirely.
 * Add any folder here that should never get a deep-import path.
 */
const EXCLUDED_DIRS_EXPORTS: Set<string> = new Set()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModuleDirs(): string[] {
  return readdirSync(srcDir)
    .filter((entry) => {
      const fullPath = join(srcDir, entry)
      if (!statSync(fullPath).isDirectory()) return false
      return existsSync(join(fullPath, "index.ts"))
    })
    .sort()
}

// ---------------------------------------------------------------------------
// 1. Barrel: src/index.ts
// ---------------------------------------------------------------------------

function generateBarrel(modules: string[]): void {
  const barrelModules = modules.filter((m) => !EXCLUDED_DIRS_BARREL.has(m))

  if (barrelModules.length === 0) {
    console.warn("[contracts] No barrel modules found — skipping src/index.ts.")
    return
  }

  const content =
    barrelModules.map((m) => `export * from "./${m}/index.js"`).join("\n") +
    "\n"

  writeFileSync(barrelPath, content, "utf-8")
  console.log(`[contracts] ✔ src/index.ts updated (${barrelModules.length} modules)`)
}

// ---------------------------------------------------------------------------
// 2. Exports: package.json
// ---------------------------------------------------------------------------

function generateExports(modules: string[]): void {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<
    string,
    unknown
  >

  const exportModules = modules.filter((m) => !EXCLUDED_DIRS_EXPORTS.has(m))

  // Root export — always present, never driven by folder scanning
  const rootExport = {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
    default: "./dist/index.js",
  }

  // Module deep-imports, alphabetically sorted
  const moduleExports: Record<string, object> = {}
  for (const m of exportModules) {
    moduleExports[`./${m}`] = {
      types: `./dist/${m}/index.d.ts`,
      import: `./dist/${m}/index.js`,
      default: `./dist/${m}/index.js`,
    }
  }

  pkg["exports"] = { ".": rootExport, ...moduleExports }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8")
  console.log(
    `[contracts] ✔ package.json exports updated (${exportModules.length} deep-import paths)`
  )
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function run(): void {
  const modules = getModuleDirs()

  if (modules.length === 0) {
    console.warn("[contracts] No modules found in src/ — aborting.")
    return
  }

  generateBarrel(modules)
  generateExports(modules)
}

run()

if (process.argv.includes("--watch")) {
  console.log("[contracts] Watching src/ for directory changes…")
  let debounce: NodeJS.Timeout | null = null
  watch(srcDir, { recursive: false }, () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      console.log("[contracts] Change detected — regenerating…")
      run()
    }, 300)
  })
}
