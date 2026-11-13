import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { WarehouseList } from "@/features/warehouse-module"

export const Route = createFileRoute("/organization/$orgId/warehouses/")({
  component: WarehousesPage,
})

function WarehousesPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <WarehouseList
      orgId={orgId}
      onViewWarehouse={(warehouseId) =>
        navigate({ to: "/organization/$orgId/warehouses/$warehouseId", params: { orgId, warehouseId } })
      }
    />
  )
}
