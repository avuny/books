import { useCallback } from "react"
import { useTranslation } from "react-i18next"

/** Formats an ISO timestamp for the current UI language (e.g. "Oct 30, 2026"). */
export function useFormatDate() {
  const { i18n } = useTranslation("organization-invitation")

  return useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
        new Date(iso)
      ),
    [i18n.language]
  )
}
