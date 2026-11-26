import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router"

import { ROUTES } from "@/features/routes"
import { useAuthenticatedHandler } from "@/features/auth"
import LoadingPage from "@workspace/ui/blocks/loading/loading-page"

export const Route = createFileRoute("/organization")({
  component: OrganizationLayout,
})

function OrganizationLayout() {
  const { data, isLoading } = useAuthenticatedHandler()

  if (isLoading) return <LoadingPage />
  if (!data?.success) return <Navigate to={ROUTES.auth.index} replace />
  // now i can log

  return (
    <div className="flex h-screen flex-col bg-muted">
      <Outlet />
    </div>
  )
}
