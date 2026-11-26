import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { EditPurchaseOrder } from "@/features/purchase-order-module"

export const Route = createFileRoute("/organization/$orgId/purchase-orders/edit/$orderId")({
  component: EditPurchaseOrderPage,
})

function EditPurchaseOrderPage() {
  const { orgId, orderId } = Route.useParams()
  const navigate = useNavigate()
  const goToDetails = () =>
    navigate({ to: "/organization/$orgId/purchase-orders/$orderId", params: { orgId, orderId } })

  return <EditPurchaseOrder orgId={orgId} orderId={orderId} onDone={goToDetails} onCancel={goToDetails} />
}
