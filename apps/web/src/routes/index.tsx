import { createFileRoute } from "@tanstack/react-router"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import type { AppRouter } from "@workspace/ui/blocks/types"
import type { Locale } from "@avuny/i18n"
import NavbarContainer from "@workspace/ui/blocks/layout/navbar-container"
import { useSignOut } from "@/api"
// import { useAuthenticatedHandler } from "@/features/auth"
// import LoadingPage from "@workspace/ui/blocks/loading/loading-page"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
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
  const { mutateAsync: signOut, isPending } = useSignOut({})

  const useSignOutHandler = () => {
    return {
      submit: async () => {
        await signOut()
      },
      isPending,
    }
  }
  // const { data: userData, isLoading } = useAuthenticatedHandler()
  // if (isLoading) return <LoadingPage />
  return (
    <NavbarContainer
      router={router}
      locale={(i18n.resolvedLanguage ?? i18n.language) as Locale}
      updateLocale={changeLanguage}
      userButton={{
        useSignOutHandler,
        href: "/auth/sign-up",
        isLoading: isPending,
        user: undefined,
      }}
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
