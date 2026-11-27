import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SalesInvoiceList } from "@/features/sales-invoice-module"

export const Route = createFileRoute("/organization/$orgId/sales-invoices/")({
  component: SalesInvoicesPage,
})

function SalesInvoicesPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <SalesInvoiceList
      orgId={orgId}
      onViewInvoice={(invoiceId) =>
        navigate({ to: "/organization/$orgId/sales-invoices/$invoiceId", params: { orgId, invoiceId } })
      }
    />
  )
}
