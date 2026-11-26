import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PurchaseOrderList } from "@/features/purchase-order-module"

export const Route = createFileRoute("/organization/$orgId/purchase-orders/")({
  component: PurchaseOrdersPage,
})

function PurchaseOrdersPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <PurchaseOrderList
      orgId={orgId}
      onViewOrder={(orderId) =>
        navigate({
          to: "/organization/$orgId/purchase-orders/$orderId",
          params: { orgId, orderId },
        })
      }
    />
  )
}
