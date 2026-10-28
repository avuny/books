import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router"

import { OrgDashboardLayout } from "@/features/organization"

export const Route = createFileRoute("/organization/$orgId")({
  component: OrgLayout,
})

function OrgLayout() {
  const { orgId } = Route.useParams()
  const location = useLocation()
  const isSettings = location.pathname.startsWith(
    `/organization/${orgId}/settings`
  )

  if (isSettings) {
    return <Outlet />
  }

  return (
    <OrgDashboardLayout orgId={orgId}>
      <Outlet />
    </OrgDashboardLayout>
  )
}
