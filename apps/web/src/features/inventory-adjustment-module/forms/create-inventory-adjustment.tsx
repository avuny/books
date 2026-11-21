import { useMemo, useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"

import {
  createItemBatch,
  fetchItemBatches,
  fetchItemDetails,
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
import type { OptionItem } from "./inventory-adjustment-form-types"
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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
  const [unitOptionsMap, setUnitOptionsMap] = useState<Record<string, OptionItem[]>>({})
  const [batchOptionsMap, setBatchOptionsMap] = useState<Record<string, OptionItem[]>>({})
  const [itemBatchTrackedMap, setItemBatchTrackedMap] = useState<Record<string, boolean>>({})

  const createMutation = useCreateInventoryAdjustmentMutation(orgId)
  const copy = useInventoryAdjustmentFormCopy("create")
  const itemComboboxCopy = useAsyncComboboxCopy()

  const { options: warehouseOptions } = useWarehouseOptions(orgId)
  const { reasons } = useInventoryAdjustmentReasons(orgId)
  const itemSource = useItemOptions(orgId)

  const effectiveWarehouseId =
    selectedWarehouseId || warehouseOptions[0]?.value || undefined

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

  const handleSubmit = async (values: CreateInventoryAdjustmentFormValues) => {
    setServerError(null)

    // Filter out trailing blank lines with no item selected (Zoho-style)
    const activeLines = values.lines.filter((l) => Boolean(l.itemId))
    if (activeLines.length === 0) {
      setServerError(copy.noLines || "At least one adjustment line is required")
      return
    }

    try {
      const response = await createMutation.mutateAsync({
        orgId,
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

  return (
    <CreateInventoryAdjustmentForm
      copy={copy}
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
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
