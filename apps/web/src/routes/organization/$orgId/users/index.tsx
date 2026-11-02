import { createFileRoute } from "@tanstack/react-router"

import { OrganizationUserList } from "@/features/organization-user-module"

export const Route = createFileRoute("/organization/$orgId/users/")({
  component: UsersPage,
})

function UsersPage() {
  const { orgId } = Route.useParams()

  return <OrganizationUserList orgId={orgId} />
}
