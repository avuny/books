import { Outlet, createFileRoute } from "@tanstack/react-router"
import { OrgSettingsLayout } from "@/features/organization"

export const Route = createFileRoute("/organization/$orgId/settings")({
  component: OrgSettingsRoute,
})

function OrgSettingsRoute() {
  const { orgId } = Route.useParams()

  return (
    <OrgSettingsLayout orgId={orgId}>
      <Outlet />
    </OrgSettingsLayout>
  )
}
