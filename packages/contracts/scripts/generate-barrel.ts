/**
 * generate-barrel.ts  (packages/contracts)
 *
 * Auto-generates src/index.ts by scanning src/* for subdirectories that
 * contain an index.ts file.
 *
 * Directories listed in EXCLUDED_DIRS are skipped (they are internal
 * utilities, not public contract modules).
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
  watch,
} from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const srcDir = resolve(__dirname, "../src")
const outputPath = resolve(__dirname, "../src/index.ts")

/**
 * Directories inside src/ that are NOT public contract modules and should be
 * excluded from the barrel.  Add new entries here as needed.
 */
const EXCLUDED_DIRS = new Set(["common", "errors"])

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateBarrel(): void {
  const modules = readdirSync(srcDir)
    .filter((entry) => {
      const fullPath = join(srcDir, entry)
      if (!statSync(fullPath).isDirectory()) return false
      if (EXCLUDED_DIRS.has(entry)) return false
      // Only include dirs that actually have an index.ts
      return existsSync(join(fullPath, "index.ts"))
    })
    .sort()

  if (modules.length === 0) {
    console.warn("[contracts] No contract modules found — aborting.")
    return
  }

  const content =
    modules.map((m) => `export * from "./${m}/index.js"`).join("\n") + "\n"

  writeFileSync(outputPath, content, "utf-8")

  console.log(`[contracts] Successfully updated: ${outputPath}`)
  console.log(`[contracts] Modules: ${modules.join(", ")}`)
}

generateBarrel()

if (process.argv.includes("--watch")) {
  console.log("[contracts] Watching for changes in src directory...")
  let timeout: NodeJS.Timeout | null = null
  watch(srcDir, { recursive: false }, () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      console.log("[contracts] Change detected, regenerating...")
      generateBarrel()
    }, 300)
  })
}
