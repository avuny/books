import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { useTranslation } from "react-i18next"

import { PurchaseOrderList } from "@/features/purchase-order-module"

export const Route = createFileRoute("/organization/$orgId/purchase-orders/")({
  component: PurchaseOrdersPage,
})

function PurchaseOrdersPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useTranslation("purchase-order")

  return (
    <PurchaseOrderList
      orgId={orgId}
      createAction={
        <>
        <Button
          variant="outline"
          onClick={() =>
            navigate({ to: "/organization/$orgId/payment-terms", params: { orgId } })
          }
        >
          {t("paymentTerms.manage")}
        </Button>
        <Button
          onClick={() =>
            navigate({ to: "/organization/$orgId/purchase-orders/new", params: { orgId } })
          }
        >
          {t("list.newButton")}
        </Button>
        </>
      }
      onViewOrder={(orderId) =>
        navigate({
          to: "/organization/$orgId/purchase-orders/$orderId",
          params: { orgId, orderId },
        })
      }
    />
  )
}
