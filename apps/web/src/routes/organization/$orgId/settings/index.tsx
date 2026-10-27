import { createFileRoute } from "@tanstack/react-router"
import { UpdateOrganization } from "@/features/organization"

export const Route = createFileRoute("/organization/$orgId/settings/")({
  component: OrgSettingsIndexPage,
})

function OrgSettingsIndexPage() {
  const { orgId } = Route.useParams()

  return <UpdateOrganization orgId={orgId} />
}
