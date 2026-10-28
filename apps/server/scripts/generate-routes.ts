// generate-routes.ts
// Auto-generates the module import block and app.route() registrations in
// src/api/routes.ts by scanning src/api/modules/* for exported *Routes identifiers.
//
// Route path override: add module → path entries to scripts/routes.config.json
//
// Usage:
//   tsx ./scripts/generate-routes.ts
//   tsx ./scripts/generate-routes.ts --watch

import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  watch,
} from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const modulesDir = resolve(__dirname, "../src/api/modules")
const routesFilePath = resolve(__dirname, "../src/api/routes.ts")
const configPath = resolve(__dirname, "routes.config.json")

// ---------------------------------------------------------------------------
// Region markers written into routes.ts so the script can surgically update
// only the auto-generated sections, leaving the rest of the file untouched.
// ---------------------------------------------------------------------------
const IMPORTS_START = "// [codegen:imports:start]"
const IMPORTS_END = "// [codegen:imports:end]"
const ROUTES_START = "// [codegen:routes:start]"
const ROUTES_END = "// [codegen:routes:end]"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCamelCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word, i) =>
      i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join("")
}

/** Reads routes.config.json (if it exists) and returns the path overrides. */
function loadConfig(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as Record<
      string,
      string
    >
  } catch {
    return {}
  }
}

/**
 * Scans a module's index.ts and returns all exported identifiers that end with
 * "Routes" (e.g. `organizationRoutes`, `usersRoutes`).
 */
function findRoutesExport(moduleDir: string): string | null {
  const indexPath = join(moduleDir, "index.ts")
  let content: string
  try {
    content = readFileSync(indexPath, "utf-8")
  } catch {
    return null
  }

  // Match patterns like:
  //   export { fooRoutes } from "..."
  //   export { fooRoutes, Bar } from "..."
  const exportedNames = [
    ...content.matchAll(/export\s*\{([^}]+)\}/g),
  ].flatMap((m) =>
    m[1]
      .split(",")
      .map((s) => s.trim().split(/\s+/)[0]) // handle "name as alias"
      .filter(Boolean)
  )

  return exportedNames.find((n) => n.endsWith("Routes")) ?? null
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

export function generateRoutes(): void {
  const config = loadConfig()

  // Collect modules that export a *Routes identifier
  const entries = readdirSync(modulesDir)
    .filter((name) => {
      const fullPath = join(modulesDir, name)
      return statSync(fullPath).isDirectory() && !name.startsWith(".")
    })
    .sort()
    .flatMap((moduleName) => {
      const moduleDir = join(modulesDir, moduleName)
      const routesExport = findRoutesExport(moduleDir)
      if (!routesExport) return []

      // Determine the URL path: prefer config override, fall back to
      // "/" + camelCase of the folder name.
      const routePath =
        config[moduleName] ?? `/${toCamelCase(moduleName)}`

      return [{ moduleName, routesExport, routePath }]
    })

  if (entries.length === 0) {
    console.warn("[routes] No *Routes exports found — aborting.")
    return
  }

  // Build the new codegen blocks
  const importsBlock = entries
    .map(
      ({ moduleName, routesExport }) =>
        `import { ${routesExport} } from "./modules/${moduleName}/index.js"`
    )
    .join("\n")

  const routesBlock = entries
    .map(({ routePath, routesExport }) => `app.route("${routePath}", ${routesExport})`)
    .join("\n")

  // Read the current routes.ts and replace between the markers
  let source = readFileSync(routesFilePath, "utf-8")

  const replaceRegion = (
    src: string,
    startMarker: string,
    endMarker: string,
    newContent: string
  ): string => {
    const startIdx = src.indexOf(startMarker)
    const endIdx = src.indexOf(endMarker)

    if (startIdx === -1 || endIdx === -1) {
      throw new Error(
        `[routes] Marker not found in routes.ts.\n  Missing: "${startMarker}" or "${endMarker}"\n  Add both marker comments to routes.ts first.`
      )
    }

    const before = src.slice(0, startIdx + startMarker.length)
    const after = src.slice(endIdx)
    return `${before}\n${newContent}\n${after}`
  }

  source = replaceRegion(source, IMPORTS_START, IMPORTS_END, importsBlock)
  source = replaceRegion(source, ROUTES_START, ROUTES_END, routesBlock)

  writeFileSync(routesFilePath, source, "utf-8")

  console.log(`[routes] Successfully updated: ${routesFilePath}`)
  console.log(
    `[routes] Registered ${entries.length} module route(s):`,
    entries.map((e) => `${e.moduleName} -> ${e.routePath}`).join(", ")
  )
}

generateRoutes()

if (process.argv.includes("--watch")) {
  console.log("[routes] Watching for changes in modules directory...")
  let timeout: NodeJS.Timeout | null = null
  watch(modulesDir, { recursive: false }, () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      console.log("[routes] Change detected, regenerating...")
      generateRoutes()
    }, 300)
  })
}
