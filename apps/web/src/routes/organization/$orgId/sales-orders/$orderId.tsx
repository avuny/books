import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SalesOrderDetails } from "@/features/sales-order-module"

export const Route = createFileRoute("/organization/$orgId/sales-orders/$orderId")({
  component: SalesOrderDetailsPage,
})

function SalesOrderDetailsPage() {
  const { orgId, orderId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <SalesOrderDetails
      orgId={orgId}
      orderId={orderId}
      onEdit={() =>
        navigate({ to: "/organization/$orgId/sales-orders/edit/$orderId", params: { orgId, orderId } })
      }
      onBack={() =>
        navigate({ to: "/organization/$orgId/sales-orders", params: { orgId } })
      }
    />
  )
}
