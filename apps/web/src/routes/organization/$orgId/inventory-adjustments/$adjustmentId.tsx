import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { InventoryAdjustmentDetails } from "@/features/inventory-adjustment-module"

export const Route = createFileRoute(
  "/organization/$orgId/inventory-adjustments/$adjustmentId"
)({
  component: InventoryAdjustmentDetailsPage,
})

function InventoryAdjustmentDetailsPage() {
  const { orgId, adjustmentId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <InventoryAdjustmentDetails
      orgId={orgId}
      adjustmentId={adjustmentId}
      onBack={() =>
        navigate({
          to: "/organization/$orgId/inventory-adjustments",
          params: { orgId },
        })
      }
    />
  )
}
