import { describe, expect, it } from "vitest"
import en from "./locales/en.json" with { type: "json" }
import ar from "./locales/ar.json" with { type: "json" }
import { PartyErrorCode } from "./errors.js"

function getLeafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...getLeafPaths(value as Record<string, unknown>, fullPath))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

function getValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc !== null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) ?? []
  return matches.sort()
}

describe("party locales (CT-LOCALE)", () => {
  it("en.json and ar.json have identical keys", () => {
    const enKeys = getLeafPaths(en).sort()
    const arKeys = getLeafPaths(ar).sort()
    expect(enKeys).toEqual(arKeys)
  })

  it("every PartyErrorCode has a translation in errors.<CODE> in both en and ar", () => {
    for (const code of Object.values(PartyErrorCode)) {
      expect((en.errors as Record<string, string>)[code]).toBeDefined()
      expect((ar.errors as Record<string, string>)[code]).toBeDefined()
    }
  })

  it("placeholders match between en.json and ar.json", () => {
    const keys = getLeafPaths(en)
    for (const key of keys) {
      const enVal = getValue(en, key)
      const arVal = getValue(ar, key)
      if (typeof enVal === "string" && typeof arVal === "string") {
        const enPlaceholders = extractPlaceholders(enVal)
        const arPlaceholders = extractPlaceholders(arVal)
        expect(arPlaceholders).toEqual(enPlaceholders)
      }
    }
  })
})
