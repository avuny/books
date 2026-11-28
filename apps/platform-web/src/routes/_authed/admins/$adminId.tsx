import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { AdminDetail } from "@/features/platform-admin-module"

export const Route = createFileRoute("/_authed/admins/$adminId")({
  component: AdminDetailRoute,
})

function AdminDetailRoute() {
  const { adminId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <AdminDetail
      adminId={adminId}
      onBack={() => navigate({ to: "/admins" })}
      onDisabled={() => navigate({ to: "/admins" })}
    />
  )
}
