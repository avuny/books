import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import { trimDecimal } from "../lib"
import type { UnitCollectionDto } from "../types"
import { UnitCollectionExtraUnitsField } from "./unit-collection-extra-units-field"
import {
  UnitCollectionFormSchema,
  type UnitCollectionFormInput,
  type UnitCollectionFormValues,
} from "./unit-collection-form-schema"
import type {
  UnitCollectionFormCopy,
  UnitInitialOptions,
  UnitPicker,
} from "./unit-collection-form-types"

export type UpdateUnitCollectionFormValues = UnitCollectionFormValues

type UpdateUnitCollectionFormProps = {
  copy: UnitCollectionFormCopy
  /** The collection being edited; its values pre-fill the form. */
  collection: UnitCollectionDto
  /** Already localized, e.g. "Meter (m)". The base unit cannot change. */
  baseUnitLabel: string
  /** Narrowed to units of the base unit's type. */
  extraUnitPicker: UnitPicker
  /** Labels of the units already in the collection. */
  initialOptions: UnitInitialOptions
  onSubmit: (values: UpdateUnitCollectionFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateUnitCollectionForm({
  copy,
  collection,
  baseUnitLabel,
  extraUnitPicker,
  initialOptions,
  onSubmit,
  isPending,
  errorMessage,
}: UpdateUnitCollectionFormProps) {
  const form = useForm<UnitCollectionFormInput, unknown, UnitCollectionFormValues>({
    resolver: zodResolver(UnitCollectionFormSchema),
    defaultValues: {
      name: collection.name,
      baseUnitId: collection.baseUnitId,
      units: collection.units
        .filter((unit) => !unit.isBase)
        .map((unit) => ({ unitId: unit.id, conversionFactor: trimDecimal(unit.conversionFactor) })),
    },
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <InputField
          control={form.control}
          name="name"
          copy={copy.name}
          type="text"
          autoComplete="off"
          autoFocus
          disabled={isPending}
        />

        <div className="grid gap-1">
          <span className="text-sm font-medium text-foreground">{copy.baseUnit.label}</span>
          <p className="text-sm text-foreground">{baseUnitLabel}</p>
          <p className="text-xs text-muted-foreground">{copy.baseUnitLocked}</p>
        </div>

        <UnitCollectionExtraUnitsField
          control={form.control}
          copy={copy.extraUnits}
          picker={extraUnitPicker}
          initialOptions={initialOptions}
          canAdd
          disabled={isPending}
        />

        <SubmitButton
          className="w-full"
          loading={isPending}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>
    </FormShell>
  )
}
