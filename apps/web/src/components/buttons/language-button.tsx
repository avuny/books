import type { Locale } from "@avuny/i18n"
import LanguageSwitcher from "@workspace/ui/blocks/settings/langauge-switcher"
import { useTranslation } from "react-i18next"

export const LanguageSwitcherButton = () => {
  const { i18n } = useTranslation()

  const changeLanguage = (locale: Locale) => {
    void i18n.changeLanguage(locale)
  }

  return (
    <LanguageSwitcher
      locale={(i18n.resolvedLanguage ?? i18n.language) as Locale}
      //   label={label}
      updateLocale={changeLanguage}
    />
  )
}
