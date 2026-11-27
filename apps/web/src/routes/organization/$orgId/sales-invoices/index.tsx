import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

import { SalesInvoiceList } from "@/features/sales-invoice-module"

export const Route = createFileRoute("/organization/$orgId/sales-invoices/")({
  component: SalesInvoicesPage,
})

function SalesInvoicesPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useTranslation("sales-invoice")
  return (
    <SalesInvoiceList
      orgId={orgId}
      headerAction={
        <Button variant="outline" onClick={() => navigate({ to: "/organization/$orgId/sales-invoices/reports", params: { orgId } })}>
          {t("ui.reports.open")}
        </Button>
      }
      onViewInvoice={(invoiceId) =>
        navigate({ to: "/organization/$orgId/sales-invoices/$invoiceId", params: { orgId, invoiceId } })
      }
    />
  )
}
