import { describe, expect, it } from "vitest"
import { ACCOUNT_MAPPING_KEYS, ACCOUNT_TYPES, JOURNAL_ENTRY_STATUSES } from "./constants.js"
import { AccountingErrorCode } from "./errors.js"
import { accountingTranslationsAr, accountingTranslationsEn } from "./locales/index.js"

type Tree = { [key: string]: string | Tree }

const flatten = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`)
  )

/** ICU placeholder names used in a string, e.g. "{count}" -> "count". */
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort()

const leaves = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`)
  )

describe("accounting locales", () => {
  it("en and ar have identical key sets", () => {
    expect(flatten(accountingTranslationsAr as Tree).sort()).toEqual(flatten(accountingTranslationsEn as Tree).sort())
  })

  it("uses the same ICU placeholders in both languages", () => {
    const ar = new Map(leaves(accountingTranslationsAr as Tree))
    for (const [key, text] of leaves(accountingTranslationsEn as Tree)) {
      expect([key, placeholders(ar.get(key) ?? "")]).toEqual([key, placeholders(text)])
    }
  })

  it("has no empty strings", () => {
    for (const tree of [accountingTranslationsEn, accountingTranslationsAr]) {
      for (const [key, text] of leaves(tree as Tree)) expect([key, text.trim().length > 0]).toEqual([key, true])
    }
  })

  it("has an error message for every error code in both languages", () => {
    for (const tree of [accountingTranslationsEn, accountingTranslationsAr] as { errors: Record<string, string> }[]) {
      for (const code of Object.values(AccountingErrorCode)) {
        expect([code, typeof tree.errors[code]]).toEqual([code, "string"])
      }
    }
  })

  it("labels every account type, mapping key and journal status", () => {
    for (const tree of [accountingTranslationsEn, accountingTranslationsAr] as {
      labels: Record<string, Record<string, string>>
    }[]) {
      for (const type of ACCOUNT_TYPES) expect([type, typeof tree.labels.accountTypes?.[type]]).toEqual([type, "string"])
      for (const key of ACCOUNT_MAPPING_KEYS) expect([key, typeof tree.labels.mappingKeys?.[key]]).toEqual([key, "string"])
      for (const status of JOURNAL_ENTRY_STATUSES) {
        expect([status, typeof tree.labels.journalStatuses?.[status]]).toEqual([status, "string"])
      }
    }
  })
})
