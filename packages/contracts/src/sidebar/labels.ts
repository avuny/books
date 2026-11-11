import { LOCALES, type Locale } from "../modules/index.js"
import { SIDEBAR_TREE } from "./constants.js"
import type { SidebarHeadingType, SidebarOptionName } from "./constants.js"

export const SIDEBAR_LOCALES = LOCALES
export type SidebarLocale = Locale
export const DEFAULT_SIDEBAR_LOCALE: SidebarLocale = "en"

export interface SidebarLabelSet {
  headings: Record<SidebarHeadingType, string>
  options: Record<SidebarOptionName, string>
}

/** Derived from the labels in the module registry; add a locale to LOCALES to get a new one. */
export const SIDEBAR_LABELS = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    {
      headings: Object.fromEntries(SIDEBAR_TREE.map((h) => [h.name, h.label[locale]])),
      options: Object.fromEntries(
        SIDEBAR_TREE.flatMap((h) => h.options.map((o) => [o.name, o.label[locale]]))
      ),
    },
  ])
) as Record<SidebarLocale, SidebarLabelSet>

/** "ar-EG" -> "ar"; anything unknown falls back to English. */
export function resolveSidebarLocale(lang?: string | null): SidebarLocale {
  const base = lang?.toLowerCase().split("-")[0] ?? ""
  return (SIDEBAR_LOCALES as readonly string[]).includes(base)
    ? (base as SidebarLocale)
    : DEFAULT_SIDEBAR_LOCALE
}

export function getSidebarLabels(lang?: string | null): SidebarLabelSet {
  return SIDEBAR_LABELS[resolveSidebarLocale(lang)]
}
