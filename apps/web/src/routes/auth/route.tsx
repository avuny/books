import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router"
import { useAuthenticatedHandler } from "@/features/auth"
import { ROUTES } from "@/features/routes"
import LoadingPage from "@workspace/ui/blocks/loading/loading-page"

import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
export const Route = createFileRoute("/auth")({ component: AuthLayout })

function AuthLayout() {
  const { data, isLoading } = useAuthenticatedHandler()
  if (isLoading) return <LoadingPage />
  // Already signed in: skip the auth pages.
  if (data?.success) return <Navigate to={ROUTES.app.main} replace />

  return (
    <div className="flex h-screen flex-col">
      <Navbar
        start={
          <>
            <HomeButton />
          </>
        }
        end={
          <>
            <ModeSwitcherBtn />

            <LanguageSwitcherButton />
          </>
        }
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted p-6 md:p-4">
        <Outlet />
      </div>
    </div>
  )
}
