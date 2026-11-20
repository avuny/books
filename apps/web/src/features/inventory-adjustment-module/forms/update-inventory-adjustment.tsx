import { useMemo, useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  normalizeInventoryAdjustment,
  useInventoryAdjustment,
  useInventoryAdjustmentReasons,
  useItemOptions,
  useUpdateInventoryAdjustmentMutation,
  useWarehouseLocationOptions,
  useWarehouseOptions,
} from "../inventory-adjustment-api"
import type { InventoryAdjustmentDto } from "../types"
import {
  UpdateInventoryAdjustmentForm,
  type UpdateInventoryAdjustmentFormValues,
} from "./update-inventory-adjustment-form"
import { useInventoryAdjustmentFormCopy } from "./use-inventory-adjustment-form-copy"

type UpdateInventoryAdjustmentProps = {
  orgId: string
  adjustmentId: string
  onSuccess?: (adjustment: InventoryAdjustmentDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function UpdateInventoryAdjustment({
  orgId,
  adjustmentId,
  onSuccess,
}: UpdateInventoryAdjustmentProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { adjustment, isLoading, error } = useInventoryAdjustment(orgId, adjustmentId)
  const updateMutation = useUpdateInventoryAdjustmentMutation(orgId)
  const copy = useInventoryAdjustmentFormCopy("update")

  const { options: warehouseOptions } = useWarehouseOptions(orgId)
  const { reasons } = useInventoryAdjustmentReasons(orgId)
  const { options: itemOptions } = useItemOptions(orgId)
  const { options: locationOptions } = useWarehouseLocationOptions(
    orgId,
    adjustment?.warehouseId ?? warehouseOptions[0]?.value
  )

  const reasonOptions = useMemo(
    () =>
      reasons.map((r) => ({
        value: r.id,
        label: `${r.name} (${r.direction})`,
      })),
    [reasons]
  )

  const handleSubmit = async (values: UpdateInventoryAdjustmentFormValues) => {
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        id: adjustmentId,
        data: {
          ...values,
          referenceNumber: values.referenceNumber?.trim() || null,
          description: values.description?.trim() || null,
          lines: values.lines?.map((l) => ({
            ...l,
            countedQuantity: String(l.countedQuantity),
            notes: l.notes?.trim() || null,
          })),
        },
      })
      onSuccess?.(normalizeInventoryAdjustment(response.data))
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

  if (!adjustment) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }

  return (
    <UpdateInventoryAdjustmentForm
      copy={copy}
      adjustment={adjustment}
      warehouseOptions={warehouseOptions}
      reasonOptions={reasonOptions}
      locationOptions={locationOptions}
      itemOptions={itemOptions}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
