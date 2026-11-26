import { createFileRoute } from "@tanstack/react-router"

import { ApReports } from "@/features/vendor-bill-module"

export const Route = createFileRoute("/organization/$orgId/vendor-bills/reports")({
  component: ApReportsPage,
})

function ApReportsPage() {
  const { orgId } = Route.useParams()
  return <ApReports orgId={orgId} />
}
