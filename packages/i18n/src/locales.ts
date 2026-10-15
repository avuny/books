// packages/i18n/src/locales.ts
// Single source of truth for supported locales. No dependencies, no Node/DOM APIs.
export const localeLabels: Record<Locale, string> = {
  en: "En",
  ar: "Ar",
}
export const locales = ["en", "ar"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

export type Direction = "ltr" | "rtl"

const directions: Record<Locale, Direction> = {
  en: "ltr",
  ar: "rtl",
}

export const getDirection = (locale: Locale): Direction => directions[locale]

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value)

/**
 * Picks the best supported locale from an Accept-Language header,
 * e.g. "ar-EG,ar;q=0.9,en;q=0.8" -> "ar". Falls back to defaultLocale.
 */
export const resolveLocale = (header: string | null | undefined): Locale => {
  if (!header) return defaultLocale

  const candidates = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";")
      const q = params.find((p) => p.trim().startsWith("q="))
      const quality = q ? Number(q.trim().slice(2)) : 1
      return {
        language: tag.trim().toLowerCase().split("-")[0] ?? "",
        quality: Number.isNaN(quality) ? 0 : quality,
      }
    })
    .filter((candidate) => candidate.quality > 0)
    .sort((a, b) => b.quality - a.quality)

  for (const { language } of candidates) {
    if (isLocale(language)) return language
  }
  return defaultLocale
}
