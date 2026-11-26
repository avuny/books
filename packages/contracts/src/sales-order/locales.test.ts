import { describe, expect, it } from "vitest"
import en from "./locales/en.json" with { type: "json" }
import ar from "./locales/ar.json" with { type: "json" }
import { SalesOrderErrorCode } from "./errors.js"

function leafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === "object"
      ? leafPaths(value as Record<string, unknown>, path)
      : [path]
  })
}

const placeholders = (text: string) => (text.match(/\{[a-zA-Z0-9_-]+\}/g) ?? []).sort()

describe("sales-order locales", () => {
  it("en.json and ar.json have identical keys", () => {
    expect(leafPaths(ar).sort()).toEqual(leafPaths(en).sort())
  })

  it("every error code has a translation in both locales", () => {
    for (const code of Object.values(SalesOrderErrorCode)) {
      expect((en.errors as Record<string, string>)[code]).toBeTruthy()
      expect((ar.errors as Record<string, string>)[code]).toBeTruthy()
    }
  })

  it("uses single-brace placeholders that match across locales", () => {
    const flat = (o: Record<string, unknown>) =>
      Object.fromEntries(leafPaths(o).map((p) => [p, p.split(".").reduce<any>((a, k) => a[k], o) as string]))
    const e = flat(en)
    const a = flat(ar)
    for (const key of Object.keys(e)) {
      expect(e[key]).not.toMatch(/\{\{/)
      expect(placeholders(a[key]!)).toEqual(placeholders(e[key]!))
    }
  })
})
