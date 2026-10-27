import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { OrganizationDetails } from "@/features/organization"

export const Route = createFileRoute("/organization/$orgId/")({
  component: OrgPage,
})

function OrgPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <OrganizationDetails
      orgId={orgId}
      onSelectOrganization={(newOrgId) => {
        void navigate({
          to: "/organization/$orgId",
          params: { orgId: newOrgId },
        })
      }}
      onNavigateToAll={() => {
        void navigate({
          to: "/organization",
          search: { all: true },
        })
      }}
      onNavigateToCreate={() => {
        void navigate({ to: "/organization/create" })
      }}
    />
  )
}
