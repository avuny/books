import { useEffect, useMemo, useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"

import {
  createItemBatch,
  fetchItemBatches,
  fetchItemDetails,
  normalizeInventoryAdjustment,
  useInventoryAdjustment,
  useInventoryAdjustmentReasons,
  useItemOptions,
  useUpdateInventoryAdjustmentMutation,
  useWarehouseLocationOptions,
  useWarehouseOptions,
} from "../inventory-adjustment-api"
import type { InventoryAdjustmentDto } from "../types"
import type { OptionItem } from "./inventory-adjustment-form-types"
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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
  const [unitOptionsMap, setUnitOptionsMap] = useState<Record<string, OptionItem[]>>({})
  const [batchOptionsMap, setBatchOptionsMap] = useState<Record<string, OptionItem[]>>({})
  const [itemBatchTrackedMap, setItemBatchTrackedMap] = useState<Record<string, boolean>>({})

  const { adjustment, isLoading, error } = useInventoryAdjustment(orgId, adjustmentId)
  const updateMutation = useUpdateInventoryAdjustmentMutation(orgId)
  const copy = useInventoryAdjustmentFormCopy("update")
  const itemComboboxCopy = useAsyncComboboxCopy()

  const { options: warehouseOptions } = useWarehouseOptions(orgId)
  const { reasons } = useInventoryAdjustmentReasons(orgId)
  const itemSource = useItemOptions(orgId)

  const effectiveWarehouseId =
    selectedWarehouseId ||
    adjustment?.warehouseId ||
    warehouseOptions[0]?.value ||
    undefined

  const { options: locationOptions } = useWarehouseLocationOptions(
    orgId,
    effectiveWarehouseId
  )

  const reasonOptions = useMemo(
    () =>
      reasons.map((r) => ({
        value: r.id,
        label: r.name,
        direction: r.direction,
      })),
    [reasons]
  )

  // Pre-load units and batches for any existing lines on the adjustment
  useEffect(() => {
    if (!adjustment?.lines) return
    const uniqueItemIds = Array.from(
      new Set(adjustment.lines.map((l) => l.itemId).filter(Boolean))
    )
    uniqueItemIds.forEach(async (id) => {
      const details = await fetchItemDetails(orgId, id)
      setUnitOptionsMap((prev) => ({
        ...prev,
        [id]: details.units,
      }))
      setItemBatchTrackedMap((prev) => ({
        ...prev,
        [id]: details.isBatchTracked,
      }))
      if (details.isBatchTracked) {
        const batches = await fetchItemBatches(orgId, id)
        setBatchOptionsMap((prev) => ({
          ...prev,
          [id]: batches,
        }))
      }
    })
  }, [adjustment, orgId])

  const handleItemChange = async (_index: number, itemId: string) => {
    if (!itemId) return
    const details = await fetchItemDetails(orgId, itemId)
    setUnitOptionsMap((prev) => ({
      ...prev,
      [itemId]: details.units,
    }))
    setItemBatchTrackedMap((prev) => ({
      ...prev,
      [itemId]: details.isBatchTracked,
    }))

    if (details.isBatchTracked) {
      const batches = await fetchItemBatches(orgId, itemId)
      setBatchOptionsMap((prev) => ({
        ...prev,
        [itemId]: batches,
      }))
    }
  }

  const handleCreateBatch = async (itemId: string, batchNumber: string) => {
    const created = await createItemBatch(orgId, itemId, batchNumber)
    if (created) {
      setBatchOptionsMap((prev) => ({
        ...prev,
        [itemId]: [...(prev[itemId] ?? []), created],
      }))
      return created.value
    }
    return null
  }

  const handleSubmit = async (values: UpdateInventoryAdjustmentFormValues) => {
    setServerError(null)

    const activeLines = values.lines?.filter((l) => Boolean(l.itemId)) ?? []
    if (activeLines.length === 0) {
      setServerError(copy.noLines || "At least one adjustment line is required")
      return
    }

    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        id: adjustmentId,
        data: {
          ...values,
          referenceNumber: values.referenceNumber?.trim() || null,
          description: values.description?.trim() || null,
          lines: activeLines.map((l) => ({
            ...l,
            batchId: itemBatchTrackedMap[l.itemId] ? (l.batchId?.trim() || null) : null,
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
        {error ? parseApiError(error).message : "Adjustment not found"}
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
      itemSource={itemSource}
      itemComboboxCopy={itemComboboxCopy}
      unitOptionsMap={unitOptionsMap}
      batchOptionsMap={batchOptionsMap}
      itemBatchTrackedMap={itemBatchTrackedMap}
      onCreateBatch={handleCreateBatch}
      onWarehouseChange={setSelectedWarehouseId}
      onItemChange={handleItemChange}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
