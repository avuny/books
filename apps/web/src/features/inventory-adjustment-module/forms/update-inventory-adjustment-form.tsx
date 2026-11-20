import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { UpdateInventoryAdjustmentSchema } from "@avuny/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  FormShell,
  InputField,
  SelectField,
  SubmitButton,
} from "@workspace/ui/blocks/form"

import { calculateLineDifference } from "../lib/calculate-line-difference"
import type {
  InventoryAdjustmentDto,
  UpdateInventoryAdjustmentInput,
} from "../types"
import type {
  InventoryAdjustmentFormCopy,
  OptionItem,
} from "./inventory-adjustment-form-types"

import type { z } from "@avuny/zod"

export type UpdateInventoryAdjustmentFormValues = UpdateInventoryAdjustmentInput
type UpdateInventoryAdjustmentFormInput = z.input<typeof UpdateInventoryAdjustmentSchema>

type UpdateInventoryAdjustmentFormProps = {
  copy: InventoryAdjustmentFormCopy
  adjustment: InventoryAdjustmentDto
  warehouseOptions: OptionItem[]
  reasonOptions: OptionItem[]
  locationOptions: OptionItem[]
  itemOptions: OptionItem[]
  unitOptionsMap?: Record<string, OptionItem[]>
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
  itemOptions,
  unitOptionsMap = {},
  onSubmit,
  isPending,
  errorMessage,
}: UpdateInventoryAdjustmentFormProps) {
  const form = useForm<
    UpdateInventoryAdjustmentFormInput,
    unknown,
    UpdateInventoryAdjustmentFormValues
  >({
    resolver: zodResolver(UpdateInventoryAdjustmentSchema),
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  })

  const linesWatch = useWatch({
    control: form.control,
    name: "lines",
  })

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

          <SelectField
            control={form.control}
            name="reasonId"
            copy={copy.reason}
            options={reasonOptions}
            disabled={isPending}
          />
        </div>

        <InputField
          control={form.control}
          name="description"
          copy={copy.formDescription}
          type="text"
          disabled={isPending}
        />

        {/* Lines Section */}
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              {copy.linesTitle}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                append({
                  itemId: "",
                  locationId: locationOptions[0]?.value ?? "",
                  unitId: "",
                  batchId: null,
                  countedQuantity: "0",
                  notes: "",
                })
              }
            >
              <Plus className="me-1 size-4" />
              {copy.addLine}
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((fieldItem, index) => {
              const lineState = linesWatch?.[index]
              const origLine = adjustment.lines[index]
              const itemUnits = lineState?.itemId ? unitOptionsMap[lineState.itemId] ?? [] : []
              const provisionalDiff = calculateLineDifference(
                lineState?.countedQuantity,
                origLine?.systemQuantityBase ?? 0
              )

              return (
                <div
                  key={fieldItem.id}
                  className="relative grid grid-cols-1 gap-3 rounded-md border border-border/60 bg-muted/20 p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-4">
                    <SelectField
                      control={form.control}
                      name={`lines.${index}.itemId` as const}
                      copy={copy.fields.item}
                      options={itemOptions}
                      disabled={isPending}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <SelectField
                      control={form.control}
                      name={`lines.${index}.locationId` as const}
                      copy={copy.fields.location}
                      options={locationOptions}
                      disabled={isPending}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <SelectField
                      control={form.control}
                      name={`lines.${index}.unitId` as const}
                      copy={copy.fields.unit}
                      options={itemUnits.length > 0 ? itemUnits : [{ value: "base", label: "Default unit" }]}
                      disabled={isPending}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <InputField
                      control={form.control}
                      name={`lines.${index}.countedQuantity` as const}
                      copy={copy.fields.countedQuantity}
                      type="number"
                      disabled={isPending}
                    />
                  </div>

                  <div className="flex items-center justify-end sm:col-span-1">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={copy.removeLine}
                        disabled={isPending}
                        onClick={() => remove(index)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>

                  <div className="col-span-full flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {copy.fields.systemQuantity}:{" "}
                      <strong className="tabular-nums text-foreground">
                        {origLine?.systemQuantityBase ?? "0.0000"}
                      </strong>
                    </span>
                    <span>
                      {copy.fields.difference}:{" "}
                      <strong className="tabular-nums text-foreground">{provisionalDiff}</strong>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

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
