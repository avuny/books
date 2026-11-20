import { useMemo, useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  normalizeInventoryAdjustment,
  useCreateInventoryAdjustmentMutation,
  useInventoryAdjustmentReasons,
  useItemOptions,
  useWarehouseLocationOptions,
  useWarehouseOptions,
} from "../inventory-adjustment-api"
import type { InventoryAdjustmentDto } from "../types"
import {
  CreateInventoryAdjustmentForm,
  type CreateInventoryAdjustmentFormValues,
} from "./create-inventory-adjustment-form"
import { useInventoryAdjustmentFormCopy } from "./use-inventory-adjustment-form-copy"

type CreateInventoryAdjustmentProps = {
  orgId: string
  onSuccess?: (adjustment: InventoryAdjustmentDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateInventoryAdjustment({
  orgId,
  onSuccess,
}: CreateInventoryAdjustmentProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const createMutation = useCreateInventoryAdjustmentMutation(orgId)
  const copy = useInventoryAdjustmentFormCopy("create")

  const { options: warehouseOptions } = useWarehouseOptions(orgId)
  const { reasons } = useInventoryAdjustmentReasons(orgId)
  const { options: itemOptions } = useItemOptions(orgId)
  const { options: locationOptions } = useWarehouseLocationOptions(
    orgId,
    warehouseOptions[0]?.value
  )

  const reasonOptions = useMemo(
    () =>
      reasons.map((r) => ({
        value: r.id,
        label: `${r.name} (${r.direction})`,
      })),
    [reasons]
  )

  const handleSubmit = async (values: CreateInventoryAdjustmentFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: {
          ...values,
          referenceNumber: values.referenceNumber?.trim() || null,
          description: values.description?.trim() || null,
          lines: values.lines.map((l) => ({
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

  return (
    <CreateInventoryAdjustmentForm
      copy={copy}
      warehouseOptions={warehouseOptions}
      reasonOptions={reasonOptions}
      locationOptions={locationOptions}
      itemOptions={itemOptions}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
