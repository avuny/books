import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { UpdateInventoryAdjustmentSchema } from "@avuny/contracts"
import {
  FormShell,
  InputField,
  LineItems,
  SelectField,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { cn } from "@workspace/ui/lib/utils"

import { calculateLineDifference } from "../lib/calculate-line-difference"
import type {
  InventoryAdjustmentDto,
  UpdateInventoryAdjustmentInput,
} from "../types"
import type {
  InventoryAdjustmentFormCopy,
  OptionItem,
} from "./inventory-adjustment-form-types"

export type UpdateInventoryAdjustmentFormValues = UpdateInventoryAdjustmentInput

const updateAdjustmentResolver: Resolver<UpdateInventoryAdjustmentFormValues> = async (
  values,
  context,
  options
) => {
  const sanitized = {
    ...values,
    lines: Array.isArray(values.lines)
      ? values.lines.filter((l) => Boolean(l && l.itemId))
      : values.lines,
  }
  return zodResolver(UpdateInventoryAdjustmentSchema)(sanitized as any, context, options)
}

type UpdateInventoryAdjustmentFormProps = {
  copy: InventoryAdjustmentFormCopy
  adjustment: InventoryAdjustmentDto
  warehouseOptions: OptionItem[]
  reasonOptions: OptionItem[]
  locationOptions: OptionItem[]
  itemSource: AsyncOptionsSource
  itemComboboxCopy: AsyncComboboxCopy
  unitOptionsMap?: Record<string, OptionItem[]>
  onWarehouseChange?: (warehouseId: string) => void
  onItemChange?: (index: number, itemId: string) => void
  onSubmit: (values: UpdateInventoryAdjustmentFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateInventoryAdjustmentForm({
  copy,
  adjustment,
  warehouseOptions,
  reasonOptions,
  locationOptions,
  itemSource,
  itemComboboxCopy,
  unitOptionsMap = {},
  onWarehouseChange,
  onItemChange,
  onSubmit,
  isPending,
  errorMessage,
}: UpdateInventoryAdjustmentFormProps) {
  const initialReason = reasonOptions.find((r) => r.value === adjustment.reasonId)
  const initialDirection =
    (initialReason?.direction as "DECREASE" | "INCREASE" | "BOTH") || "BOTH"
  const [direction, setDirection] = useState<"DECREASE" | "INCREASE" | "BOTH">(initialDirection)

  const filteredReasonOptions = useMemo(() => {
    if (direction === "BOTH") return reasonOptions
    return reasonOptions.filter(
      (r) => !r.direction || r.direction === direction || r.direction === "BOTH"
    )
  }, [reasonOptions, direction])

  const form = useForm<UpdateInventoryAdjustmentFormValues>({
    resolver: updateAdjustmentResolver,
    defaultValues: {
      date: adjustment.date,
      referenceNumber: adjustment.referenceNumber ?? "",
      warehouseId: adjustment.warehouseId,
      reasonId: adjustment.reasonId,
      description: adjustment.description ?? "",
      lines: adjustment.lines.map((l) => ({
        itemId: l.itemId,
        locationId: l.locationId,
        unitId: l.unitId,
        batchId: l.batchId ?? null,
        countedQuantity: l.countedQuantity,
        notes: l.notes ?? "",
      })),
    },
  })

  const watchedWarehouseId = useWatch({
    control: form.control,
    name: "warehouseId",
  })

  // Synchronize filtered reason options
  useEffect(() => {
    const currentReasonId = form.getValues("reasonId")
    if (filteredReasonOptions.length > 0) {
      const exists = filteredReasonOptions.some((r) => r.value === currentReasonId)
      if (!exists) {
        form.setValue("reasonId", filteredReasonOptions[0].value)
      }
    }
  }, [filteredReasonOptions, form])

  useEffect(() => {
    if (watchedWarehouseId) {
      onWarehouseChange?.(watchedWarehouseId)
    }
  }, [watchedWarehouseId, onWarehouseChange])

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
            <label className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {copy.direction.label}
            </label>
            <div className="flex rounded-md border border-input p-1 bg-muted/40">
              {(["DECREASE", "INCREASE", "BOTH"] as const).map((dir) => {
                const isSelected = direction === dir
                const label =
                  dir === "DECREASE"
                    ? copy.direction.decrease
                    : dir === "INCREASE"
                      ? copy.direction.increase
                      : copy.direction.both
                return (
                  <button
                    key={dir}
                    type="button"
                    disabled={isPending}
                    onClick={() => setDirection(dir)}
                    className={cn(
                      "flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                      isSelected
                        ? "bg-background text-foreground shadow-xs font-semibold"
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
            const currentLoc = form.getValues(`lines.${index}.locationId` as any)
            if (!currentLoc && locationOptions.length > 0) {
              form.setValue(`lines.${index}.locationId` as any, locationOptions[0].value)
            }
          }}
          renderFields={({ index, disabled, line }) => {
            const lineData = line as any
            const itemUnits = lineData?.itemId ? unitOptionsMap[lineData.itemId] ?? [] : []

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

                {/* Row 2: Unit, Counted Quantity, Notes */}
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
                            label: lineData?.unitId ? "Selected unit" : "Select unit",
                          },
                        ]
                    }
                    disabled={disabled}
                  />
                </div>

                <div className="sm:col-span-3">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.countedQuantity` as const}
                    copy={copy.fields.countedQuantity}
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
            const provisionalDiff = calculateLineDifference(lineData?.countedQuantity, 0)
            return (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {copy.fields.difference}:{" "}
                  <strong className="tabular-nums text-foreground">
                    {provisionalDiff}
                  </strong>
                </span>
              </div>
            )
          }}
        />

        <SubmitButton
          className="w-full"
          loading={isPending}
          label={copy.submitDraftLabel}
          loadingLabel={copy.submittingDraftLabel}
        />
      </form>
    </FormShell>
  )
}
