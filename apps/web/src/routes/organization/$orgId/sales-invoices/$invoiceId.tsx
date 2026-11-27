import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SalesInvoiceDetails } from "@/features/sales-invoice-module"

export const Route = createFileRoute("/organization/$orgId/sales-invoices/$invoiceId")({
  component: SalesInvoiceDetailsPage,
})

function SalesInvoiceDetailsPage() {
  const { orgId, invoiceId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <SalesInvoiceDetails
      orgId={orgId}
      invoiceId={invoiceId}
      onBack={() => navigate({ to: "/organization/$orgId/sales-invoices", params: { orgId } })}
    />
  )
}
