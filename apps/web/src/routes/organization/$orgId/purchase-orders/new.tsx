import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { CreatePurchaseOrder } from "@/features/purchase-order-module"

export const Route = createFileRoute("/organization/$orgId/purchase-orders/new")({
  component: NewPurchaseOrderPage,
})

function NewPurchaseOrderPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <CreatePurchaseOrder
      orgId={orgId}
      onCancel={() =>
        navigate({ to: "/organization/$orgId/purchase-orders", params: { orgId } })
      }
      onCreated={(orderId) =>
        navigate({
          to: "/organization/$orgId/purchase-orders/$orderId",
          params: { orgId, orderId },
        })
      }
    />
  )
}
