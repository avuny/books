import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { WarehouseLocations } from "@/features/warehouse-location-module"

export const Route = createFileRoute("/organization/$orgId/warehouses/$warehouseId/locations/")({
  component: WarehouseLocationsPage,
})

function WarehouseLocationsPage() {
  const { orgId, warehouseId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <WarehouseLocations
      orgId={orgId}
      warehouseId={warehouseId}
      onBack={() => navigate({ to: "/organization/$orgId/warehouses/$warehouseId", params: { orgId, warehouseId } })}
      onViewLocation={(locationId) =>
        navigate({
          to: "/organization/$orgId/warehouses/$warehouseId/locations/$locationId",
          params: { orgId, warehouseId, locationId },
        })
      }
    />
  )
}
