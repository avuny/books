import { cleanup, renderHook } from "@testing-library/react"
import { createInstance } from "i18next"
import { createElement, type ReactNode } from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// TODO(owner): point these at your real "user" namespace files (needs resolveJsonModule).
import ar from "@/locales/ar/user.json"
import en from "@/locales/en/user.json"

import { useSignInCopy, useSignInErrors } from "../sign-in-copy"

// Real i18next instance + real locale files, and NO fallback language, so a key
// that is missing in `ar` shows up as the raw key instead of silently falling
// back to English.
const i18n = createInstance()

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: false,
    ns: ["user"],
    defaultNS: "user",
    resources: { en: { user: en }, ar: { user: ar } },
    interpolation: { escapeValue: false },
  })
})

afterEach(cleanup)

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(I18nextProvider, { i18n }, children)

async function inLanguage<T>(lng: "en" | "ar", useHook: () => T): Promise<T> {
  await i18n.changeLanguage(lng)
  return renderHook(useHook, { wrapper }).result.current
}

/** Every string leaf of a (possibly nested) object. */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(stringsOf)
  }
  return []
}

// i18next returns the raw key when a translation is missing.
const looksLikeKey = (s: string) => /^auth\.[\w.]+$/.test(s)

describe.each(["en", "ar"] as const)("sign-in copy (%s)", (lng) => {
  it("translates the form strings", async () => {
    const values = stringsOf(await inLanguage(lng, useSignInCopy))

    expect(values.length).toBeGreaterThan(0)
    expect(values.filter(looksLikeKey)).toEqual([]) // no raw keys leaked
    expect(values.filter((s) => s.trim() === "")).toEqual([]) // no empty strings
  })

  it("translates the API error messages", async () => {
    const errors = await inLanguage(lng, useSignInErrors)

    expect(errors.fallback).toBeTruthy()
    expect(errors.INVALID_CREDENTIALS).toBeTruthy()
    expect(stringsOf(errors).filter(looksLikeKey)).toEqual([])
  })
})

describe("sign-in copy language switching", () => {
  it("returns different text for en and ar", async () => {
    const enCopy = await inLanguage("en", useSignInCopy)
    const arCopy = await inLanguage("ar", useSignInCopy)

    expect(arCopy.title).not.toBe(enCopy.title)
    expect(arCopy.submitLabel).not.toBe(enCopy.submitLabel)
  })
})
