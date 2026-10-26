import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router"

import { ROUTES } from "@/features/routes"
import { useAuthenticatedHandler } from "@/features/auth"
import { SettingsLayout } from "@/features/user"
import LoadingPage from "@workspace/ui/blocks/loading/loading-page"

export const Route = createFileRoute("/user")({
  component: UserLayout,
})

function UserLayout() {
  const { data, isLoading } = useAuthenticatedHandler()

  if (isLoading) return <LoadingPage />
  if (!data?.success) return <Navigate to={ROUTES.auth.index} replace />

  return (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  )
}
