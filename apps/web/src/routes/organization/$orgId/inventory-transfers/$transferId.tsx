import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { TransferDetails } from "@/features/inventory-transfer-module"

export const Route = createFileRoute("/organization/$orgId/inventory-transfers/$transferId")({
  component: InventoryTransferDetailsPage,
})

function InventoryTransferDetailsPage() {
  const { orgId, transferId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <TransferDetails
      orgId={orgId}
      transferId={transferId}
      onBack={() => navigate({ to: "/organization/$orgId/inventory-transfers", params: { orgId } })}
    />
  )
}
