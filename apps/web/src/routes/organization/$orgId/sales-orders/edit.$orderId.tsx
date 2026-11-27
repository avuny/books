import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { EditSalesOrder } from "@/features/sales-order-module"

export const Route = createFileRoute("/organization/$orgId/sales-orders/edit/$orderId")({
  component: EditSalesOrderPage,
})

function EditSalesOrderPage() {
  const { orgId, orderId } = Route.useParams()
  const navigate = useNavigate()
  const goToDetails = () =>
    navigate({ to: "/organization/$orgId/sales-orders/$orderId", params: { orgId, orderId } })

  return <EditSalesOrder orgId={orgId} orderId={orderId} onDone={goToDetails} onCancel={goToDetails} />
}
