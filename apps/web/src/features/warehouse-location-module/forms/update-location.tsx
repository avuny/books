import { useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { getAllowedLocationTypes, useWarehouseLocationLabels } from "../lib"
import {
  useLocation,
  useLocationWarehouse,
  useUpdateLocationMutation,
} from "../warehouse-location-api"
import type { WarehouseLocationDto } from "../types"
import { UpdateLocationForm, type UpdateLocationFormValues } from "./update-location-form"
import { useLocationFormCopy } from "./use-location-form-copy"

type UpdateLocationProps = {
  orgId: string
  warehouseId: string
  locationId: string
  onSuccess?: (location: WarehouseLocationDto) => void
}

// Composition only: strings + API behavior wired into the pure form. Loads by id because list rows lack fields.
export function UpdateLocation({ orgId, warehouseId, locationId, onSuccess }: UpdateLocationProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { location, isLoading, error } = useLocation(orgId, locationId)
  const { warehouse } = useLocationWarehouse(orgId, warehouseId)
  const updateMutation = useUpdateLocationMutation(orgId, warehouseId)
  const copy = useLocationFormCopy("update")
  const { getTypeLabel } = useWarehouseLocationLabels()

  const handleSubmit = async (values: UpdateLocationFormValues) => {
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({ orgId, locationId, data: values })
      onSuccess?.(response.data as WarehouseLocationDto)
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  if (isLoading || (location && !warehouse)) {
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }
  if (!location || !warehouse) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }

  // The parent is the second-to-last item of the path. Keep the current type selectable even if the rule changed.
  const parentType = location.path.length > 1 ? (location.path[location.path.length - 2]?.type ?? null) : null
  const allowed = getAllowedLocationTypes(parentType, warehouse.type)
  const types = allowed.includes(location.type) ? allowed : [location.type, ...allowed]

  return (
    <UpdateLocationForm
      copy={copy}
      location={location}
      typeOptions={types.map((value) => ({ value, label: getTypeLabel(value) }))}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
