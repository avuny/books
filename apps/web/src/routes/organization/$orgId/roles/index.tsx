import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { RoleList } from "@/features/role-module"

export const Route = createFileRoute("/organization/$orgId/roles/")({
  component: RolesPage,
})

function RolesPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <RoleList
      orgId={orgId}
      onViewRole={(roleId) =>
        navigate({
          to: "/organization/$orgId/roles/$roleId",
          params: { orgId, roleId },
        })
      }
    />
  )
}
