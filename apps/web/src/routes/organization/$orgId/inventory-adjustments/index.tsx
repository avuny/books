import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { InventoryAdjustmentList } from "@/features/inventory-adjustment-module"

export const Route = createFileRoute(
  "/organization/$orgId/inventory-adjustments/"
)({
  component: InventoryAdjustmentsPage,
})

function InventoryAdjustmentsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <InventoryAdjustmentList
      orgId={orgId}
      onViewAdjustment={(adjustmentId) =>
        navigate({
          to: "/organization/$orgId/inventory-adjustments/$adjustmentId",
          params: { orgId, adjustmentId },
        })
      }
    />
  )
}
