import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { CreateInventoryAdjustmentSchema } from "@avuny/contracts"
import {
  FormShell,
  InputField,
  LineItems,
  SelectField,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { CreateInventoryAdjustmentInput } from "../types"
import type {
  InventoryAdjustmentFormCopy,
  OptionItem,
} from "./inventory-adjustment-form-types"

export type CreateInventoryAdjustmentFormValues = CreateInventoryAdjustmentInput

const createAdjustmentResolver: Resolver<
  CreateInventoryAdjustmentFormValues
> = async (values, context, options) => {
  const sanitized = {
    ...values,
    lines: Array.isArray(values.lines)
      ? values.lines.filter((l) => Boolean(l && l.itemId))
      : values.lines,
  }
  return zodResolver(CreateInventoryAdjustmentSchema)(
    sanitized as any,
    context,
    options
  )
}

type CreateInventoryAdjustmentFormProps = {
  copy: InventoryAdjustmentFormCopy
  warehouseOptions: OptionItem[]
  reasonOptions: OptionItem[]
  locationOptions: OptionItem[]
  itemSource: AsyncOptionsSource
  itemComboboxCopy: AsyncComboboxCopy
  unitOptionsMap?: Record<string, OptionItem[]> // itemId -> unit options
  batchOptionsMap?: Record<string, OptionItem[]> // itemId -> batch options
  itemBatchTrackedMap?: Record<string, boolean> // itemId -> isBatchTracked
  stockSnapshots?: Record<string, { systemQuantity: string; snapshotToken: string }>
  direction?: "DECREASE" | "INCREASE"
  onDirectionChange?: (dir: "DECREASE" | "INCREASE") => void
  onLineDimensionChange?: (params: {
    warehouseId: string
    itemId: string
    locationId: string
    unitId: string
    batchId?: string | null
  }) => void
  onCreateBatch?: (
    itemId: string,
    batchNumber: string
  ) => Promise<string | null>
  onWarehouseChange?: (warehouseId: string) => void
  onItemChange?: (index: number, itemId: string) => void
  onSubmit: (values: CreateInventoryAdjustmentFormValues) => void
  onConfirm?: (values: CreateInventoryAdjustmentFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateInventoryAdjustmentForm({
  copy,
  warehouseOptions,
  reasonOptions,
  locationOptions,
  itemSource,
  itemComboboxCopy,
  unitOptionsMap = {},
  batchOptionsMap = {},
  itemBatchTrackedMap = {},
  stockSnapshots = {},
  direction: controlledDirection,
  onDirectionChange,
  onLineDimensionChange,
  onWarehouseChange,
  onItemChange,
  onSubmit,
  onConfirm,
  isPending,
  errorMessage,
}: CreateInventoryAdjustmentFormProps) {
  const [internalDirection, setInternalDirection] = useState<"DECREASE" | "INCREASE">("DECREASE")
  const currentDirection = controlledDirection ?? internalDirection

  const setDirection = (dir: "DECREASE" | "INCREASE") => {
    setInternalDirection(dir)
    onDirectionChange?.(dir)
  }

  const filteredReasonOptions = useMemo(() => {
    return reasonOptions.filter(
      (r) =>
        !r.direction ||
        r.direction === currentDirection ||
        r.direction === "BOTH" ||
        r.code === "OTHER" ||
        r.label.toLowerCase().includes("other") ||
        r.label.includes("أخرى")
    )
  }, [reasonOptions, currentDirection])

  const form = useForm<CreateInventoryAdjustmentFormValues>({
    resolver: createAdjustmentResolver,
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      referenceNumber: "",
      warehouseId: warehouseOptions[0]?.value ?? "",
      reasonId:
        filteredReasonOptions[0]?.value ?? reasonOptions[0]?.value ?? "",
      description: "",
      lines: [
        {
          itemId: "",
          locationId: "",
          unitId: "",
          batchId: null,
          countedQuantity: "0",
          notes: "",
        },
      ],
    },
  })

  const watchedWarehouseId = useWatch({
    control: form.control,
    name: "warehouseId",
  })

  const watchedLines = useWatch({
    control: form.control,
    name: "lines",
  })

  // Synchronize initial or updated warehouse options
  useEffect(() => {
    if (!form.getValues("warehouseId") && warehouseOptions.length > 0) {
      const initialWarehouseId = warehouseOptions[0].value
      form.setValue("warehouseId", initialWarehouseId)
      onWarehouseChange?.(initialWarehouseId)
    }
  }, [warehouseOptions, form, onWarehouseChange])

  // Synchronize filtered reason options
  useEffect(() => {
    const currentReasonId = form.getValues("reasonId")
    if (filteredReasonOptions.length > 0) {
      const exists = filteredReasonOptions.some(
        (r) => r.value === currentReasonId
      )
      if (!exists) {
        form.setValue("reasonId", filteredReasonOptions[0].value)
      }
    }
  }, [filteredReasonOptions, form])

  // Notify parent container of warehouse changes so location options refresh
  useEffect(() => {
    if (watchedWarehouseId) {
      onWarehouseChange?.(watchedWarehouseId)
    }
  }, [watchedWarehouseId, onWarehouseChange])

  // Set default unit when unitOptionsMap is updated for an item
  useEffect(() => {
    const lines = form.getValues("lines")
    lines?.forEach((line, index) => {
      if (line?.itemId && !line.unitId) {
        const units = unitOptionsMap[line.itemId]
        if (units && units.length > 0) {
          form.setValue(`lines.${index}.unitId` as any, units[0].value)
        }
      }
    })
  }, [unitOptionsMap, form])

  // Notify parent of dimension changes to load stock snapshots
  useEffect(() => {
    if (!watchedLines || !watchedWarehouseId) return
    watchedLines.forEach((line) => {
      if (line && line.itemId && line.locationId && line.unitId) {
        onLineDimensionChange?.({
          warehouseId: watchedWarehouseId,
          itemId: line.itemId,
          locationId: line.locationId,
          unitId: line.unitId,
          batchId: line.batchId,
        })
      }
    })
  }, [watchedLines, watchedWarehouseId, onLineDimensionChange])

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField
            control={form.control}
            name="date"
            copy={copy.date}
            type="date"
            disabled={isPending}
          />

          <InputField
            control={form.control}
            name="referenceNumber"
            copy={copy.referenceNumber}
            type="text"
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="warehouseId"
            copy={copy.warehouse}
            options={warehouseOptions}
            disabled={isPending}
          />

          <div className="space-y-2">
            <label className="text-sm leading-none font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {copy.direction.label}
            </label>
            <div className="flex rounded-md border border-input bg-muted/40 p-1">
              {(["DECREASE", "INCREASE"] as const).map((dir) => {
                const isSelected = currentDirection === dir
                const label =
                  dir === "DECREASE"
                    ? copy.direction.decrease
                    : copy.direction.increase
                return (
                  <button
                    key={dir}
                    type="button"
                    disabled={isPending}
                    onClick={() => setDirection(dir)}
                    className={cn(
                      "flex-1 cursor-pointer rounded-sm px-3 py-1.5 text-xs font-medium transition-all",
                      isSelected
                        ? "bg-background font-semibold text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="reasonId"
            copy={copy.reason}
            options={filteredReasonOptions}
            disabled={isPending}
          />

          <InputField
            control={form.control}
            name="description"
            copy={copy.formDescription}
            type="text"
            disabled={isPending}
          />
        </div>

        {/* Reusable Zoho-style Line Items Component */}
        <LineItems
          control={form.control}
          name="lines"
          blankLine={{
            itemId: "",
            locationId: locationOptions[0]?.value ?? "",
            unitId: "",
            batchId: null,
            countedQuantity: "0",
            notes: "",
          }}
          copy={{
            title: copy.linesTitle,
            addLine: copy.addLine,
            removeLine: copy.removeLine,
            noLines: copy.noLines,
            item: copy.fields.item,
          }}
          itemSource={itemSource}
          itemComboboxCopy={itemComboboxCopy}
          itemPlaceholder={copy.fields.item.placeholder}
          itemColSpan="sm:col-span-7"
          disabled={isPending}
          onItemChange={(index, itemId) => {
            onItemChange?.(index, itemId)
            // Pre-select first location if not set yet
            const currentLoc = form.getValues(
              `lines.${index}.locationId` as any
            )
            if (!currentLoc && locationOptions.length > 0) {
              form.setValue(
                `lines.${index}.locationId` as any,
                locationOptions[0].value
              )
            }
          }}
          renderFields={({ index, disabled, line }) => {
            const lineData = line as any
            const itemId: string = lineData?.itemId ?? ""
            const itemUnits = itemId ? (unitOptionsMap[itemId] ?? []) : []
            const isBatchTracked = itemId
              ? (itemBatchTrackedMap[itemId] ?? false)
              : false
            const batchOptions = itemId ? (batchOptionsMap[itemId] ?? []) : []

            return (
              <>
                {/* Row 1 remainder: Location */}
                <div className="sm:col-span-5">
                  <SelectField
                    control={form.control}
                    name={`lines.${index}.locationId` as const}
                    copy={copy.fields.location}
                    options={locationOptions}
                    disabled={disabled}
                  />
                </div>

                {/* Row 2: Unit, Batch (conditional), Counted Quantity, Notes */}
                <div className="sm:col-span-3">
                  <SelectField
                    control={form.control}
                    name={`lines.${index}.unitId` as const}
                    copy={copy.fields.unit}
                    options={
                      itemUnits.length > 0
                        ? itemUnits
                        : [
                            {
                              value: lineData?.unitId || "base",
                              label: lineData?.unitId
                                ? "Selected unit"
                                : "Select unit",
                            },
                          ]
                    }
                    disabled={disabled}
                  />
                </div>

                {isBatchTracked && (
                  <div className="sm:col-span-3">
                    <SelectField
                      control={form.control}
                      name={`lines.${index}.batchId` as const}
                      copy={copy.fields.batch}
                      options={batchOptions}
                      disabled={disabled}
                    />
                  </div>
                )}

                <div className="sm:col-span-3">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.countedQuantity` as const}
                    copy={{
                      label:
                        currentDirection === "DECREASE"
                          ? copy.direction.decrease
                          : copy.direction.increase,
                      placeholder: "0.0000",
                    }}
                    type="number"
                    disabled={disabled}
                  />
                </div>

                <div className="sm:col-span-6">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.notes` as const}
                    copy={copy.fields.notes}
                    type="text"
                    disabled={disabled}
                  />
                </div>
              </>
            )
          }}
          renderRowFooter={({ line }) => {
            const lineData = line as any
            const itemId = lineData?.itemId ?? ""
            const locationId = lineData?.locationId ?? ""
            const unitId = lineData?.unitId ?? ""
            const batchId = lineData?.batchId ?? ""
            const key = `${itemId}:${locationId}:${unitId}:${batchId}`
            const snap = stockSnapshots[key]
            const systemQty = snap?.systemQuantity ?? "0.0000"
            const enteredQty = Number(lineData?.countedQuantity || 0)

            const diffNum =
              currentDirection === "DECREASE" ? -enteredQty : enteredQty
            const formattedDiff =
              diffNum > 0
                ? `+${diffNum.toFixed(4)}`
                : diffNum < 0
                  ? diffNum.toFixed(4)
                  : "0.0000"

            const resultingStockNum =
              currentDirection === "DECREASE"
                ? Math.max(0, Number(systemQty) - enteredQty)
                : Number(systemQty) + enteredQty

            return (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>
                    {copy.fields.systemQuantity}:{" "}
                    <strong className="text-foreground tabular-nums">
                      {Number(systemQty).toFixed(4)}
                    </strong>
                  </span>
                  <span>
                    {copy.fields.difference}:{" "}
                    <strong
                      className={cn(
                        "tabular-nums",
                        diffNum > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : diffNum < 0
                            ? "text-destructive"
                            : "text-foreground"
                      )}
                    >
                      {formattedDiff}
                    </strong>
                  </span>
                  <span>
                    {copy.fields.countedQuantity.label}:{" "}
                    <strong className="text-foreground tabular-nums">
                      {resultingStockNum.toFixed(4)}
                    </strong>
                  </span>
                </div>
              </div>
            )
          }}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton
            className="flex-1"
            variant="outline"
            loading={isPending}
            label={copy.submitDraftLabel}
            loadingLabel={copy.submittingDraftLabel}
          />
          {onConfirm && (
            <Button
              type="button"
              className="flex-1"
              disabled={isPending}
              onClick={form.handleSubmit(onConfirm)}
            >
              {copy.submitConfirmLabel}
            </Button>
          )}
        </div>
      </form>
    </FormShell>
  )
}
