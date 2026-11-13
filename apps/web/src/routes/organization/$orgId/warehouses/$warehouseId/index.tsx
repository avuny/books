import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { WarehouseDetails } from "@/features/warehouse-module"

export const Route = createFileRoute("/organization/$orgId/warehouses/$warehouseId/")({
  component: WarehouseDetailsPage,
})

function WarehouseDetailsPage() {
  const { orgId, warehouseId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <WarehouseDetails
      orgId={orgId}
      warehouseId={warehouseId}
      onBack={() => navigate({ to: "/organization/$orgId/warehouses", params: { orgId } })}
      onViewLocations={() =>
        navigate({ to: "/organization/$orgId/warehouses/$warehouseId/locations", params: { orgId, warehouseId } })
      }
    />
  )
}
