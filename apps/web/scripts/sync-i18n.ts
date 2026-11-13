/**
 * sync-i18n.ts
 *
 * Keeps apps/web/src/i18n/resources.ts and i18n.ts in sync with every
 * contract module that ships a locales/index.ts (i.e. exports
 * `<camel>TranslationsEn` and `<camel>TranslationsAr`).
 *
 * Usage:
 *   pnpm --filter @avuny/books-web sync:i18n          # patch + report
 *   pnpm --filter @avuny/books-web sync:i18n --check  # CI: exit 1 if drift
 *
 * The script is intentionally dependency-free (Node built-ins only) so it
 * runs without a build step via `node --experimental-strip-types`.
 */

import { execSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

// ---------------------------------------------------------------------------
// Paths (all relative to the monorepo root)
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, "../../..")
const CONTRACTS_SRC = join(ROOT, "packages/contracts/src")
const RESOURCES_FILE = join(ROOT, "apps/web/src/i18n/resources.ts")
const I18N_FILE = join(ROOT, "apps/web/src/i18n/i18n.ts")

const CHECK_ONLY = process.argv.includes("--check")

// ---------------------------------------------------------------------------
// 1. Discover modules: any contracts/src/<slug>/locales/index.ts that exports
//    both `<camel>TranslationsEn` and `<camel>TranslationsAr`.
// ---------------------------------------------------------------------------

/** kebab-case → camelCase  (warehouse-location → warehouseLocation) */
function toCamel(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

interface ModuleInfo {
  /** kebab-case slug used as the i18n namespace (e.g. "warehouse-location") */
  slug: string
  /** camelCase prefix (e.g. "warehouseLocation") */
  camel: string
  /** import path relative to @avuny/contracts (e.g. "@avuny/contracts/warehouse-location") */
  importPath: string
  /** En export name (e.g. "warehouseLocationTranslationsEn") */
  en: string
  /** Ar export name (e.g. "warehouseLocationTranslationsAr") */
  ar: string
}

function discoverModules(): ModuleInfo[] {
  const modules: ModuleInfo[] = []

  for (const entry of readdirSync(CONTRACTS_SRC, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const slug = entry.name
    const localesIndex = join(CONTRACTS_SRC, slug, "locales", "index.ts")
    if (!existsSync(localesIndex)) continue

    const src = readFileSync(localesIndex, "utf8")
    const camel = toCamel(slug)
    const enExport = `${camel}TranslationsEn`
    const arExport = `${camel}TranslationsAr`

    if (!src.includes(enExport) || !src.includes(arExport)) continue

    modules.push({
      slug,
      camel,
      importPath: `@avuny/contracts/${slug}`,
      en: enExport,
      ar: arExport,
    })
  }

  // Sort deterministically (alphabetical) so diffs are stable.
  return modules.sort((a, b) => a.slug.localeCompare(b.slug))
}

// ---------------------------------------------------------------------------
// 2. Build the desired resources.ts content
// ---------------------------------------------------------------------------

function buildResourcesFile(modules: ModuleInfo[]): string {
  const imports = modules
    .map((m) => `import { ${m.ar}, ${m.en} } from "${m.importPath}"`)
    .join("\n")

  const enEntries = modules
    .map((m) => `    "${m.slug}": ${m.en},`)
    .join("\n")

  const arEntries = modules
    .map((m) => `    "${m.slug}": ${m.ar},`)
    .join("\n")

  return `${imports}

export const resources = {
  en: {
${enEntries}
  },
  ar: {
${arEntries}
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
`
}

// ---------------------------------------------------------------------------
// 3. Patch i18n.ts — replace the `ns: [...]` array in-place
// ---------------------------------------------------------------------------

function buildNsArray(modules: ModuleInfo[]): string {
  const entries = modules.map((m) => `      "${m.slug}",`).join("\n")
  return `    ns: [\n${entries}\n    ],`
}

function patchI18nFile(modules: ModuleInfo[], original: string): string {
  // Match the existing ns array (possibly multiline).
  const nsPattern = /ns:\s*\[[\s\S]*?\],/
  const replacement = buildNsArray(modules)
  if (!nsPattern.test(original)) {
    throw new Error(
      `Could not locate "ns: [...]" in ${I18N_FILE}. ` +
        "Please add it manually and re-run."
    )
  }
  return original.replace(nsPattern, replacement)
}

// ---------------------------------------------------------------------------
// 4. Format a string through prettier (used to normalise before diffing)
// ---------------------------------------------------------------------------

function formatWithPrettier(content: string, filepath: string): string {
  try {
    return execSync(
      `pnpm prettier --stdin-filepath "${filepath}"`,
      { cwd: ROOT, input: content }
    ).toString()
  } catch {
    // prettier unavailable — compare raw
    return content
  }
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------

function main() {
  const modules = discoverModules()
  console.log(
    `Found ${modules.length} contract modules with locales:\n` +
      modules.map((m) => `  • ${m.slug}`).join("\n")
  )

  // --- resources.ts --------------------------------------------------------
  const desiredResources = formatWithPrettier(
    buildResourcesFile(modules),
    RESOURCES_FILE
  )
  const currentResources = existsSync(RESOURCES_FILE)
    ? readFileSync(RESOURCES_FILE, "utf8")
    : ""

  const resourcesDrifted = currentResources !== desiredResources

  // --- i18n.ts -------------------------------------------------------------
  const currentI18n = existsSync(I18N_FILE)
    ? readFileSync(I18N_FILE, "utf8")
    : ""
  const desiredI18n = formatWithPrettier(
    patchI18nFile(modules, currentI18n),
    I18N_FILE
  )
  const i18nDrifted = currentI18n !== desiredI18n

  if (!resourcesDrifted && !i18nDrifted) {
    console.log("\n✅  i18n files are already in sync.")
    return
  }

  if (CHECK_ONLY) {
    if (resourcesDrifted)
      console.error("\n❌  resources.ts is out of sync with contracts.")
    if (i18nDrifted)
      console.error("\n❌  i18n.ts ns array is out of sync with contracts.")
    console.error('\nRun "pnpm sync:i18n" to fix.')
    process.exit(1)
  }

  if (resourcesDrifted) {
    writeFileSync(RESOURCES_FILE, desiredResources, "utf8")
    console.log("\n✏️   Updated resources.ts")
  }

  if (i18nDrifted) {
    writeFileSync(I18N_FILE, desiredI18n, "utf8")
    console.log("✏️   Updated i18n.ts (ns array)")
  }

  console.log("\n✅  Done. Commit the updated i18n files.")
}

main()
