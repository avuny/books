import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import {
  CreateWarehouseLocationSchema,
  WAREHOUSE_LOCATION_PURPOSE_FLAGS,
  defaultFlags,
  isStockableType,
} from "@avuny/contracts"

import {
  AsyncComboboxField,
  FormShell,
  InputField,
  SelectField,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import { CheckboxRow } from "../components"
import type { CreateWarehouseLocationInput, WarehouseLocationType } from "../types"
import type { LocationFormCopy } from "./location-form-types"

import type { z } from "@avuny/zod"

export type CreateLocationFormValues = CreateWarehouseLocationInput
type CreateLocationFormInput = z.input<typeof CreateWarehouseLocationSchema> // pre-transform shape

const BLANK_TO_UNDEFINED = ["parentId", "name", "width", "height", "depth", "maxWeight", "maxVolume"] as const

type CreateLocationFormProps = {
  copy: LocationFormCopy
  comboboxCopy: AsyncComboboxCopy
  /** Containers of the warehouse (valid parents). */
  parentSource: AsyncOptionsSource
  /** Given: the location is created inside it and the parent cannot be changed. */
  fixedParent: { id: string; name: string } | null
  /** Types allowed here, already translated. */
  typeOptions: { value: string; label: string }[]
  /** Fetches the next free code for a type; null when none could be suggested. */
  onSuggestCode?: (input: { type: WarehouseLocationType; parentId?: string }) => Promise<string | null>
  onSubmit: (values: CreateLocationFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

const baseResolver = zodResolver(CreateWarehouseLocationSchema)

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateLocationForm({
  copy,
  comboboxCopy,
  parentSource,
  fixedParent,
  typeOptions,
  onSuggestCode,
  onSubmit,
  isPending,
  errorMessage,
}: CreateLocationFormProps) {
  const initialType = (typeOptions.find((o) => o.value === "bin")?.value ?? typeOptions[0]?.value ?? "bin") as WarehouseLocationType
  const initialFlags = defaultFlags(initialType, "storage")

  const form = useForm<CreateLocationFormInput, unknown, CreateLocationFormValues>({
    resolver: (values, context, options) => baseResolver(mapBlanks(values, BLANK_TO_UNDEFINED, undefined), context, options),
    defaultValues: {
      parentId: fixedParent?.id ?? "",
      code: "",
      name: "",
      type: initialType,
      purpose: "storage",
      ...initialFlags,
      width: "",
      height: "",
      depth: "",
      maxWeight: "",
      maxVolume: "",
    },
  })

  const type = useWatch({ control: form.control, name: "type" })
  const isStockable = useWatch({ control: form.control, name: "isStockable" })

  // A new type proposes its default capabilities; a new purpose keeps stockability and re-derives pickable/receivable.
  // The user can still override everything.
  // Un-ticking "can hold stock" also clears the capabilities that depend on it.
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type" && value.type) {
        const flags = defaultFlags(value.type, value.purpose ?? "storage")
        form.setValue("isStockable", flags.isStockable)
        form.setValue("isPickable", flags.isPickable)
        form.setValue("isReceivable", flags.isReceivable)
      }
      if (name === "purpose" && value.type) {
        const stockable = Boolean(value.isStockable)
        const fromPurpose = WAREHOUSE_LOCATION_PURPOSE_FLAGS[value.purpose ?? "storage"]
        form.setValue("isPickable", stockable && fromPurpose.isPickable)
        form.setValue("isReceivable", stockable && fromPurpose.isReceivable)
      }
      if (name === "isStockable" && !value.isStockable) {
        form.setValue("isPickable", false)
        form.setValue("isReceivable", false)
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const canBeStockable = isStockableType(type)

  const suggestCode = async () => {
    if (!onSuggestCode) return
    const parentId = fixedParent?.id ?? (form.getValues("parentId") || undefined)
    const code = await onSuggestCode({ type: form.getValues("type"), parentId })
    if (code) form.setValue("code", code, { shouldValidate: true, shouldDirty: true })
  }

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        {fixedParent ? (
          <p className="text-sm text-muted-foreground">
            {copy.parent.fixed} <span className="font-medium text-foreground">{fixedParent.name}</span>
          </p>
        ) : (
          <AsyncComboboxField
            control={form.control}
            name="parentId"
            copy={copy.parent}
            comboboxCopy={comboboxCopy}
            source={parentSource}
            disabled={isPending}
            placeholder={copy.parent.placeholder}
          />
        )}

        <SelectField control={form.control} name="type" copy={copy.type} options={typeOptions} disabled={isPending} />

        <div className="space-y-2">
          <InputField control={form.control} name="code" copy={copy.code} type="text" autoComplete="off" autoFocus disabled={isPending} />
          {onSuggestCode ? (
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => void suggestCode()}>
              {copy.code.suggest}
            </Button>
          ) : null}
        </div>

        <InputField control={form.control} name="name" copy={copy.name} type="text" autoComplete="off" disabled={isPending} />
        <SelectField control={form.control} name="purpose" copy={copy.purpose} options={copy.purposeOptions} disabled={isPending} />

        <fieldset className="space-y-3">
          <CheckboxRow
            control={form.control}
            name="isStockable"
            label={copy.isStockable.label}
            description={copy.isStockable.description}
            disabled={isPending || !canBeStockable}
          />
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
