import { readdirSync, statSync, writeFileSync, watch } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const localesDir = resolve(__dirname, "../src/api/intl/locales")
const i18nextTsPath = resolve(__dirname, "../src/api/intl/i18next.ts")
const i18nextDtsPath = resolve(__dirname, "../src/api/intl/i18next.d.ts")

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function generateIntlFiles(): void {
  const entries = readdirSync(localesDir)
  const modules = entries
    .filter((entry) => {
      const fullPath = resolve(localesDir, entry)
      return statSync(fullPath).isDirectory()
    })
    .sort()

  const moduleInfos = modules.map((name) => {
    return {
      raw: name,
      camel: toCamelCase(name),
      pascal: toPascalCase(name),
      hasHyphen: name.includes("-"),
    }
  })

  // 1. Generate i18next.ts
  const tsImports = moduleInfos
    .map((m) => {
      return `import ${m.camel}En from "./locales/${m.raw}/en.json" with { type: "json" }\nimport ${m.camel}Ar from "./locales/${m.raw}/ar.json" with { type: "json" }`
    })
    .join("\n")

  const enResourcesEntries = moduleInfos
    .flatMap((m) => {
      const lines = [`        ${m.camel}: ${m.camel}En,`]
      if (m.hasHyphen) {
        lines.unshift(`        "${m.raw}": ${m.camel}En,`)
      }
      return lines
    })
    .join("\n")

  const arResourcesEntries = moduleInfos
    .flatMap((m) => {
      const lines = [`        ${m.camel}: ${m.camel}Ar,`]
      if (m.hasHyphen) {
        lines.unshift(`        "${m.raw}": ${m.camel}Ar,`)
      }
      return lines
    })
    .join("\n")

  const nsList = moduleInfos
    .flatMap((m) => {
      return m.hasHyphen ? [`"${m.raw}"`, `"${m.camel}"`] : [`"${m.raw}"`]
    })
    .join(", ")

  const i18nextTsContent = `import i18next from "i18next"
${tsImports}
import { Locale } from "@avuny/i18n"

export const resources = {
  en: {
${enResourcesEntries}
  },
  ar: {
${arResourcesEntries}
  },
} as const

export type Resources = (typeof resources)["en"]

/**
 * Call once at startup. Never call i18n.changeLanguage() on the server: it is global and races
 * between concurrent requests. Use trans({ lang }) (= i18next.getFixedT) for every translation.
 */
export function installRequestLanguage(): void {
  i18next.init({
    lng: "en",
    fallbackLng: "en",
    ns: [${nsList}],
    defaultNS: "otp",
    resources,
    interpolation: { escapeValue: false },
  })
}

/**
 * Returns a fixed-t translator bound to the given language.
 * Use with handleResult's errorTrans param.
 *
 * @example
 *   const errorTrans = trans({ lang })
 *   // then pass errorTrans to handleResult
 */
export function trans({ lang }: { lang: Locale }) {
  return (key: string): string => i18next.t(key as any, { lng: lang })
}
`

  // 2. Generate i18next.d.ts following the exact requested pattern
  const dtsImports = moduleInfos
    .map((m) => `import type ${m.camel}En from "./locales/${m.raw}/en.json"`)
    .join("\n")

  const dtsTypeAliases = moduleInfos
    .map((m) => `type ${m.pascal}Messages = typeof ${m.camel}En`)
    .join("\n")

  const dtsResourceEntries = moduleInfos
    .flatMap((m) => {
      const lines = [`      ${m.camel}: ${m.pascal}Messages`]
      if (m.hasHyphen) {
        lines.unshift(`      "${m.raw}": ${m.pascal}Messages`)
      }
      return lines
    })
    .join("\n")

  const i18nextDtsContent = `${dtsImports}

${dtsTypeAliases}

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "otp"
    resources: {
${dtsResourceEntries}
    }
  }
}
`

  writeFileSync(i18nextTsPath, i18nextTsContent, "utf-8")
  writeFileSync(i18nextDtsPath, i18nextDtsContent, "utf-8")

  console.log(`[i18n] Successfully updated:`)
  console.log(`  - ${i18nextTsPath}`)
  console.log(`  - ${i18nextDtsPath}`)
  console.log(`[i18n] Modules: ${moduleInfos.map((m) => m.raw).join(", ")}`)
}

generateIntlFiles()

if (process.argv.includes("--watch")) {
  console.log("[i18n] Watching for changes in locales directory...")
  let timeout: NodeJS.Timeout | null = null
  watch(localesDir, { recursive: true }, () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      console.log("[i18n] Change detected, regenerating...")
      generateIntlFiles()
    }, 200)
  })
}
