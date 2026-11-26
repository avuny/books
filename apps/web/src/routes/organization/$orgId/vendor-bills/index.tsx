import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { useTranslation } from "react-i18next"

import { VendorBillList } from "@/features/vendor-bill-module"

export const Route = createFileRoute("/organization/$orgId/vendor-bills/")({
  component: VendorBillsPage,
})

function VendorBillsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useTranslation("vendor-bill")
  return (
    <VendorBillList
      orgId={orgId}
      headerAction={
        <Button variant="outline" onClick={() => navigate({ to: "/organization/$orgId/vendor-bills/reports", params: { orgId } })}>
          {t("ui.reports.open")}
        </Button>
      }
      onViewBill={(billId) =>
        navigate({ to: "/organization/$orgId/vendor-bills/$billId", params: { orgId, billId } })
      }
    />
  )
}
