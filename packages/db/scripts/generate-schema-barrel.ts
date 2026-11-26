/**
 * generate-schema-barrel.ts  (packages/db)
 *
 * Auto-generates src/schema/index.ts by scanning src/schema/* for
 * subdirectories that contain an index.ts file.
 *
 * Usage:
 *   tsx ./scripts/generate-schema-barrel.ts
 *   tsx ./scripts/generate-schema-barrel.ts --watch
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

const schemaDir = resolve(__dirname, "../src/schema")
const outputPath = resolve(__dirname, "../src/schema/index.ts")

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateSchemaBarrel(): void {
  const modules = readdirSync(schemaDir)
    .filter((entry) => {
      const fullPath = join(schemaDir, entry)
      if (!statSync(fullPath).isDirectory()) return false
      // Only include dirs that actually have an index.ts
      return existsSync(join(fullPath, "index.ts"))
    })
    .sort()

  if (modules.length === 0) {
    console.warn("[db:schema] No schema modules found — aborting.")
    return
  }

  const content =
    modules.map((m) => `export * from "./${m}/index.js"`).join("\n") + "\n"

  writeFileSync(outputPath, content, "utf-8")

  console.log(`[db:schema] Successfully updated: ${outputPath}`)
  console.log(`[db:schema] Modules: ${modules.join(", ")}`)
}

generateSchemaBarrel()

if (process.argv.includes("--watch")) {
  console.log("[db:schema] Watching for changes in src/schema directory...")
  let timeout: NodeJS.Timeout | null = null
  watch(schemaDir, { recursive: false }, () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      console.log("[db:schema] Change detected, regenerating...")
      generateSchemaBarrel()
    }, 300)
  })
}
