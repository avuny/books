import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { UpdateWarehouseLocationSchema, WAREHOUSE_LOCATION_PURPOSE_FLAGS, isStockableType } from "@avuny/contracts"

import { FormShell, InputField, SelectField, SubmitButton } from "@workspace/ui/blocks/form"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import { CheckboxRow } from "../components"
import type { UpdateWarehouseLocationInput, WarehouseLocationDetailDto } from "../types"
import type { LocationFormCopy } from "./location-form-types"

import type { z } from "@avuny/zod"

export type UpdateLocationFormValues = UpdateWarehouseLocationInput
type UpdateLocationFormInput = z.input<typeof UpdateWarehouseLocationSchema>

// Clearing a measure sends null so the stored value is removed; a blank name keeps the current one.
const MEASURES = ["width", "height", "depth", "maxWeight", "maxVolume"] as const

type UpdateLocationFormProps = {
  copy: LocationFormCopy
  location: WarehouseLocationDetailDto
  /** Types allowed here, already translated (always includes the current type). */
  typeOptions: { value: string; label: string }[]
  onSubmit: (values: UpdateLocationFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

const baseResolver = zodResolver(UpdateWarehouseLocationSchema)

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateLocationForm({ copy, location, typeOptions, onSubmit, isPending, errorMessage }: UpdateLocationFormProps) {
  const form = useForm<UpdateLocationFormInput, unknown, UpdateLocationFormValues>({
    resolver: (values, context, options) =>
      baseResolver(mapBlanks(mapBlanks(values, ["name"], undefined), MEASURES, null), context, options),
    defaultValues: {
      code: location.code,
      name: location.name,
      type: location.type,
      purpose: location.purpose,
      applyToDescendants: false,
      isStockable: location.isStockable,
      isPickable: location.isPickable,
      isReceivable: location.isReceivable,
      width: location.width ?? "",
      height: location.height ?? "",
      depth: location.depth ?? "",
      maxWeight: location.maxWeight ?? "",
      maxVolume: location.maxVolume ?? "",
    },
  })

  const type = useWatch({ control: form.control, name: "type" })
  const isStockable = useWatch({ control: form.control, name: "isStockable" })

  // A changed type or purpose re-derives the capabilities that depend on them: stockability survives only if the
  // type allows it, pickable/receivable follow the purpose. The user can still override everything.
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if ((name === "type" || name === "purpose") && value.type) {
        const stockable = Boolean(value.isStockable) && isStockableType(value.type)
        const fromPurpose = WAREHOUSE_LOCATION_PURPOSE_FLAGS[value.purpose ?? location.purpose]
        form.setValue("isStockable", stockable)
        form.setValue("isPickable", stockable && fromPurpose.isPickable)
        form.setValue("isReceivable", stockable && fromPurpose.isReceivable)
      }
      if (name === "isStockable" && !value.isStockable) {
        form.setValue("isPickable", false)
        form.setValue("isReceivable", false)
      }
    })
    return () => subscription.unsubscribe()
  }, [form, location.purpose])

  const canBeStockable = type ? isStockableType(type) : false

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <SelectField control={form.control} name="type" copy={copy.type} options={typeOptions} disabled={isPending} />
        <InputField control={form.control} name="code" copy={copy.code} type="text" autoComplete="off" autoFocus disabled={isPending} />
        <InputField control={form.control} name="name" copy={copy.name} type="text" autoComplete="off" disabled={isPending} />
        <SelectField control={form.control} name="purpose" copy={copy.purpose} options={copy.purposeOptions} disabled={isPending} />
        <CheckboxRow
          control={form.control}
          name="applyToDescendants"
          label={copy.applyToDescendants.label}
          description={copy.applyToDescendants.description}
          disabled={isPending || !location.hasChildren}
        />

        <fieldset className="space-y-3">
          <CheckboxRow control={form.control} name="isStockable" label={copy.isStockable.label} description={copy.isStockable.description} disabled={isPending || !canBeStockable || location.hasChildren} />
          <CheckboxRow control={form.control} name="isPickable" label={copy.isPickable.label} description={copy.isPickable.description} disabled={isPending || !isStockable} />
          <CheckboxRow control={form.control} name="isReceivable" label={copy.isReceivable.label} description={copy.isReceivable.description} disabled={isPending || !isStockable} />
        </fieldset>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">{copy.measures.title}</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <InputField control={form.control} name="width" copy={copy.measures.width} type="text" inputMode="decimal" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="height" copy={copy.measures.height} type="text" inputMode="decimal" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="depth" copy={copy.measures.depth} type="text" inputMode="decimal" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="maxWeight" copy={copy.measures.maxWeight} type="text" inputMode="decimal" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="maxVolume" copy={copy.measures.maxVolume} type="text" inputMode="decimal" autoComplete="off" disabled={isPending} />
          </div>
        </details>

        <SubmitButton className="w-full" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
