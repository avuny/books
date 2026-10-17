import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import type { AppRouter } from "@workspace/ui/blocks/types"
import type { Locale } from "@avuny/i18n"
import NavbarContainer from "@workspace/ui/blocks/layout/navbar-container"

export function App() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const router: AppRouter = {
    push: (href) => {
      void navigate({ href })
    },
    replace: (href) => {
      void navigate({ href, replace: true })
    },
  }

  const changeLanguage = (locale: Locale) => {
    void i18n.changeLanguage(locale)
  }

  return (
    <NavbarContainer
      router={router}
      locale={(i18n.resolvedLanguage ?? i18n.language) as Locale}
      updateLocale={changeLanguage}
    >
      <div className="flex min-h-svh p-6">
        <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
          <h1>{t("common.welcome")}</h1>

          <div className="font-mono text-xs text-muted-foreground">
            (Press <kbd>d</kbd> to toggle dark mode)
          </div>
        </div>
      </div>
    </NavbarContainer>
  )
}
