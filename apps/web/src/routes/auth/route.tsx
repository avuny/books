import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router"
import { useAuthenticatedHandler } from "@/features/auth"
import { ROUTES } from "@/features/routes"
import LoadingPage from "@workspace/ui/blocks/loading/loading-page"

import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import type { AppRouter } from "@workspace/ui/blocks/types"
import type { Locale } from "@avuny/i18n"
import NavbarContainer from "@workspace/ui/blocks/layout/navbar-container"
export const Route = createFileRoute("/auth")({ component: AuthLayout })

function AuthLayout() {
  const { i18n } = useTranslation()
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

  const { data, isLoading } = useAuthenticatedHandler()
  if (isLoading) return <LoadingPage />
  // Already signed in: skip the auth pages.
  if (data?.data.success) return <Navigate to={ROUTES.app.main} replace />

  return (
    <NavbarContainer
      router={router}
      locale={(i18n.resolvedLanguage ?? i18n.language) as Locale}
      updateLocale={changeLanguage}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted p-6 md:p-4">
        <Outlet />
      </div>
    </NavbarContainer>
  )
}
