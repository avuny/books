import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { useTranslation } from "react-i18next"

import { SalesOrderList } from "@/features/sales-order-module"

export const Route = createFileRoute("/organization/$orgId/sales-orders/")({
  component: SalesOrdersPage,
})

function SalesOrdersPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useTranslation("sales-order")

  return (
    <SalesOrderList
      orgId={orgId}
      createAction={
        <>
        <Button
          onClick={() =>
            navigate({ to: "/organization/$orgId/sales-orders/new", params: { orgId } })
          }
        >
          {t("list.newButton")}
        </Button>
        </>
      }
      onViewOrder={(orderId) =>
        navigate({
          to: "/organization/$orgId/sales-orders/$orderId",
          params: { orgId, orderId },
        })
      }
    />
  )
}
