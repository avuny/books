import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PurchaseOrderDetails } from "@/features/purchase-order-module"

export const Route = createFileRoute("/organization/$orgId/purchase-orders/$orderId")({
  component: PurchaseOrderDetailsPage,
})

function PurchaseOrderDetailsPage() {
  const { orgId, orderId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <PurchaseOrderDetails
      orgId={orgId}
      orderId={orderId}
      onBack={() =>
        navigate({ to: "/organization/$orgId/purchase-orders", params: { orgId } })
      }
    />
  )
}
