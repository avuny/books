import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { AdminsList } from "@/features/platform-admin-module"

export const Route = createFileRoute("/_authed/admins/")({
  component: AdminsRoute,
})

function AdminsRoute() {
  const navigate = useNavigate()
  return (
    <AdminsList
      onViewAdmin={(adminId) =>
        navigate({ to: "/admins/$adminId", params: { adminId } })
      }
    />
  )
}
