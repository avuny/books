import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { CreateSalesOrder } from "@/features/sales-order-module"

export const Route = createFileRoute("/organization/$orgId/sales-orders/new")({
  component: NewSalesOrderPage,
})

function NewSalesOrderPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <CreateSalesOrder
      orgId={orgId}
      onCancel={() =>
        navigate({ to: "/organization/$orgId/sales-orders", params: { orgId } })
      }
      onCreated={(orderId) =>
        navigate({
          to: "/organization/$orgId/sales-orders/$orderId",
          params: { orgId, orderId },
        })
      }
    />
  )
}
