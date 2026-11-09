import { useEffect, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { AsyncComboboxField, FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import { UnitCollectionExtraUnitsField } from "./unit-collection-extra-units-field"
import {
  UnitCollectionFormSchema,
  type UnitCollectionFormInput,
  type UnitCollectionFormValues,
} from "./unit-collection-form-schema"
import type { UnitCollectionFormCopy, UnitPicker } from "./unit-collection-form-types"

export type CreateUnitCollectionFormValues = UnitCollectionFormValues

type CreateUnitCollectionFormProps = {
  copy: UnitCollectionFormCopy
  baseUnitPicker: UnitPicker
  /** Narrowed to units of the chosen base unit's type. */
  extraUnitPicker: UnitPicker
  /** Lets the composition component narrow `extraUnitPicker` to the base unit's type. */
  onBaseUnitChange?: (baseUnitId: string | undefined) => void
  onSubmit: (values: CreateUnitCollectionFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateUnitCollectionForm({
  copy,
  baseUnitPicker,
  extraUnitPicker,
  onBaseUnitChange,
  onSubmit,
  isPending,
  errorMessage,
}: CreateUnitCollectionFormProps) {
  const form = useForm<UnitCollectionFormInput, unknown, UnitCollectionFormValues>({
    resolver: zodResolver(UnitCollectionFormSchema),
    defaultValues: { name: "", baseUnitId: "", units: [] },
  })

  const baseUnitId = form.watch("baseUnitId")
  const previousBase = useRef(baseUnitId)
  useEffect(() => {
    // Other units must measure the same thing as the base unit: a new base unit starts over.
    if (previousBase.current !== baseUnitId) {
      if (previousBase.current) form.setValue("units", [])
      previousBase.current = baseUnitId
    }
    onBaseUnitChange?.(baseUnitId || undefined)
  }, [baseUnitId, form, onBaseUnitChange])

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

        <AsyncComboboxField
          control={form.control}
          name="baseUnitId"
          copy={copy.baseUnit}
          comboboxCopy={baseUnitPicker.copy}
          source={baseUnitPicker.source}
          disabled={isPending}
          placeholder={copy.baseUnit.placeholder}
        />

        <UnitCollectionExtraUnitsField
          control={form.control}
          copy={copy.extraUnits}
          picker={extraUnitPicker}
          canAdd={Boolean(baseUnitId)}
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
