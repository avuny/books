import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { LocationDetails } from "@/features/warehouse-location-module"

export const Route = createFileRoute("/organization/$orgId/warehouses/$warehouseId/locations/$locationId")({
  component: LocationDetailsPage,
})

function LocationDetailsPage() {
  const { orgId, warehouseId, locationId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <LocationDetails
      orgId={orgId}
      warehouseId={warehouseId}
      locationId={locationId}
      onBack={() =>
        navigate({ to: "/organization/$orgId/warehouses/$warehouseId/locations", params: { orgId, warehouseId } })
      }
      onViewLocation={(id) =>
        navigate({
          to: "/organization/$orgId/warehouses/$warehouseId/locations/$locationId",
          params: { orgId, warehouseId, locationId: id },
        })
      }
    />
  )
}
