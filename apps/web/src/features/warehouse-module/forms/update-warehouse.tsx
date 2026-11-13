import { useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeWarehouse, useUpdateWarehouseMutation, useWarehouse } from "../warehouse-api"
import type { WarehouseDto } from "../types"
import { UpdateWarehouseForm, type UpdateWarehouseFormValues } from "./update-warehouse-form"
import { useWarehouseFormCopy } from "./use-warehouse-form-copy"

type UpdateWarehouseProps = {
  orgId: string
  warehouseId: string
  onSuccess?: (warehouse: WarehouseDto) => void
}

// Composition only: strings + API behavior wired into the pure form. Loads by id because list rows lack fields.
export function UpdateWarehouse({ orgId, warehouseId, onSuccess }: UpdateWarehouseProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { warehouse, isLoading, error } = useWarehouse(orgId, warehouseId)
  const updateMutation = useUpdateWarehouseMutation(orgId)
  const copy = useWarehouseFormCopy("update")

  const handleSubmit = async (values: UpdateWarehouseFormValues) => {
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({ orgId, warehouseId, data: values })
      onSuccess?.(normalizeWarehouse(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }
  if (!warehouse) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }
  return (
    <UpdateWarehouseForm
      copy={copy}
      warehouse={warehouse}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
