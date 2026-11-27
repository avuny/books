import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { TransferList } from "@/features/inventory-transfer-module"

export const Route = createFileRoute("/organization/$orgId/inventory-transfers/")({
  component: InventoryTransfersPage,
})

function InventoryTransfersPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <TransferList
      orgId={orgId}
      onView={(transferId) =>
        navigate({ to: "/organization/$orgId/inventory-transfers/$transferId", params: { orgId, transferId } })
      }
    />
  )
}
