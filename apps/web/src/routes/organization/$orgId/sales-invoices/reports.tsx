import { createFileRoute } from "@tanstack/react-router"

import { ArReports } from "@/features/sales-invoice-module"

export const Route = createFileRoute("/organization/$orgId/sales-invoices/reports")({
  component: ArReportsPage,
})

function ArReportsPage() {
  const { orgId } = Route.useParams()
  return <ArReports orgId={orgId} />
}
