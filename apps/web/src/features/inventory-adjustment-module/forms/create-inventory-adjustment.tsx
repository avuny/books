import { useMemo, useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { ConfirmDialog } from "@workspace/ui/blocks/data-table"

import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"

import {
  createItemBatch,
  fetchItemBatches,
  fetchItemDetails,
  fetchStockSnapshot,
  normalizeInventoryAdjustment,
  useConfirmInventoryAdjustmentMutation,
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
  const [direction, setDirection] = useState<"DECREASE" | "INCREASE">("DECREASE")
  const [stockSnapshots, setStockSnapshots] = useState<
    Record<string, { systemQuantity: string; snapshotToken: string }>
  >({})
  const [unitOptionsMap, setUnitOptionsMap] = useState<
    Record<string, OptionItem[]>
  >({})
  const [batchOptionsMap, setBatchOptionsMap] = useState<
    Record<string, OptionItem[]>
  >({})
  const [itemBatchTrackedMap, setItemBatchTrackedMap] = useState<
    Record<string, boolean>
  >({})

  // Confirm flow: hold form values waiting for user confirmation
  const [pendingConfirmValues, setPendingConfirmValues] =
    useState<CreateInventoryAdjustmentFormValues | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const createMutation = useCreateInventoryAdjustmentMutation(orgId)
  const confirmMutation = useConfirmInventoryAdjustmentMutation(orgId)
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
        code: r.code,
        direction: r.direction,
      })),
    [reasons]
  )

  const handleLineDimensionChange = async (params: {
    warehouseId: string
    itemId: string
    locationId: string
    unitId: string
    batchId?: string | null
  }) => {
    if (
      !params.warehouseId ||
      !params.itemId ||
      !params.locationId ||
      !params.unitId
    )
      return
    const key = `${params.itemId}:${params.locationId}:${params.unitId}:${params.batchId || ""}`
    if (stockSnapshots[key]) return
    const snap = await fetchStockSnapshot(orgId, params)
    if (snap) {
      setStockSnapshots((prev) => ({
        ...prev,
        [key]: {
          systemQuantity: snap.systemQuantitySelectedUnit,
          snapshotToken: snap.snapshotToken,
        },
      }))
    }
  }

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

    const defaultLoc = locationOptions[0]?.value
    const defaultUnit = details.baseUnitId || details.units[0]?.value
    if (effectiveWarehouseId && defaultLoc && defaultUnit) {
      handleLineDimensionChange({
        warehouseId: effectiveWarehouseId,
        itemId,
        locationId: defaultLoc,
        unitId: defaultUnit,
      })
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

  /** Build the sanitised API payload from raw form values, converting entered adjustment quantities to target counted quantities. */
  const buildPayload = async (
    values: CreateInventoryAdjustmentFormValues,
    dir: "DECREASE" | "INCREASE"
  ) => {
    const activeLines = values.lines.filter((l) => Boolean(l.itemId))
    const warehouseId = values.warehouseId || effectiveWarehouseId || ""

    const resolvedLines = await Promise.all(
      activeLines.map(async (l) => {
        const key = `${l.itemId}:${l.locationId}:${l.unitId}:${l.batchId || ""}`
        let snap = stockSnapshots[key]
        if (!snap && warehouseId && l.itemId && l.locationId && l.unitId) {
          const fetched = await fetchStockSnapshot(orgId, {
            warehouseId,
            itemId: l.itemId,
            locationId: l.locationId,
            unitId: l.unitId,
            batchId: l.batchId,
          })
          if (fetched) {
            snap = {
              systemQuantity: fetched.systemQuantitySelectedUnit,
              snapshotToken: fetched.snapshotToken,
            }
          }
        }

        const currentStock = Number(snap?.systemQuantity ?? 0)
        const enteredQty = Number(l.countedQuantity || 0)
        const finalCounted =
          dir === "DECREASE"
            ? Math.max(0, currentStock - enteredQty)
            : currentStock + enteredQty

        return {
          ...l,
          batchId: itemBatchTrackedMap[l.itemId]
            ? l.batchId?.trim() || null
            : null,
          countedQuantity: finalCounted.toFixed(4),
          snapshotToken: snap?.snapshotToken || null,
          notes: l.notes?.trim() || null,
        }
      })
    )

    return {
      ...values,
      referenceNumber: values.referenceNumber?.trim() || null,
      description: values.description?.trim() || null,
      lines: resolvedLines,
    }
  }

  /** Save as draft only. */
  const handleSubmit = async (values: CreateInventoryAdjustmentFormValues) => {
    setServerError(null)
    const activeLines = values.lines.filter((l) => Boolean(l.itemId))
    if (activeLines.length === 0) {
      setServerError(copy.noLines || "At least one adjustment line is required")
      return
    }

    try {
      const payload = await buildPayload(values, direction)
      const response = await createMutation.mutateAsync({
        orgId,
        data: payload,
      })
      onSuccess?.(normalizeInventoryAdjustment(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  /**
   * "Confirm & post" button: validate the form, stash the values so the
   * confirmation dialog can show, then wait for the user to click Confirm.
   */
  const handleConfirmIntent = (values: CreateInventoryAdjustmentFormValues) => {
    setServerError(null)
    setConfirmError(null)
    const activeLines = values.lines.filter((l) => Boolean(l.itemId))
    if (activeLines.length === 0) {
      setServerError(copy.noLines || "At least one adjustment line is required")
      return
    }
    setPendingConfirmValues(values)
  }

  /** User clicked "Confirm" inside the dialog → create draft then confirm it. */
  const handleConfirmDialogConfirm = async () => {
    if (!pendingConfirmValues) return
    setConfirmError(null)

    try {
      const payload = await buildPayload(pendingConfirmValues, direction)
      const createResponse = await createMutation.mutateAsync({
        orgId,
        data: payload,
      })
      const draft = normalizeInventoryAdjustment(createResponse.data)

      await confirmMutation.mutateAsync({ orgId, id: draft.id })

      setPendingConfirmValues(null)
      onSuccess?.(draft)
    } catch (e) {
      setConfirmError(parseApiError(e).message || null)
    }
  }

  const isConfirmPending =
    createMutation.isPending || confirmMutation.isPending

  return (
    <>
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
        stockSnapshots={stockSnapshots}
        direction={direction}
        onDirectionChange={setDirection}
        onLineDimensionChange={handleLineDimensionChange}
        onCreateBatch={handleCreateBatch}
        onWarehouseChange={setSelectedWarehouseId}
        onItemChange={handleItemChange}
        onSubmit={handleSubmit}
        onConfirm={handleConfirmIntent}
        isPending={createMutation.isPending}
        errorMessage={serverError}
      />

      <ConfirmDialog
        open={pendingConfirmValues !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConfirmValues(null)
            setConfirmError(null)
          }
        }}
        title={copy.confirmDialogTitle}
        description={confirmError ?? copy.confirmDialogDescription}
        confirmLabel={copy.submitConfirmLabel}
        cancelLabel={copy.cancelLabel}
        destructive={false}
        isLoading={isConfirmPending}
        onConfirm={handleConfirmDialogConfirm}
      />
    </>
  )
}
