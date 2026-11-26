import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { RoleDetails } from "@/features/role-module"

export const Route = createFileRoute("/organization/$orgId/roles/$roleId")({
  component: RoleDetailsPage,
})

function RoleDetailsPage() {
  const { orgId, roleId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <RoleDetails
      orgId={orgId}
      roleId={roleId}
      onBack={() =>
        navigate({ to: "/organization/$orgId/roles", params: { orgId } })
      }
    />
  )
}
