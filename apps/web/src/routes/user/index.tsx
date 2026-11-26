import { Navigate, createFileRoute } from "@tanstack/react-router"
import { ROUTES } from "@/features/routes"

export const Route = createFileRoute("/user/")({
  component: UserIndexPage,
})

function UserIndexPage() {
  return <Navigate to={ROUTES.user.settings} replace />
}
