import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { CreateWarehouseSchema } from "@avuny/contracts"

import { FormShell, InputField, SelectField, SubmitButton } from "@workspace/ui/blocks/form"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import { CheckboxRow } from "../components"
import type { CreateWarehouseInput } from "../types"
import type { WarehouseFormCopy } from "./warehouse-form-types"

import type { z } from "@avuny/zod"

export type CreateWarehouseFormValues = CreateWarehouseInput
type CreateWarehouseFormInput = z.input<typeof CreateWarehouseSchema> // pre-transform shape

const OPTIONAL_TEXT = ["description", "addressLine", "city", "region", "postalCode", "countryCode"] as const
const ADDRESS_KEYS = ["addressLine", "city", "region", "postalCode", "countryCode"] as const

type CreateWarehouseFormProps = {
  copy: WarehouseFormCopy
  onSubmit: (values: CreateWarehouseFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

const baseResolver = zodResolver(CreateWarehouseSchema)

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateWarehouseForm({ copy, onSubmit, isPending, errorMessage }: CreateWarehouseFormProps) {
  const form = useForm<CreateWarehouseFormInput, unknown, CreateWarehouseFormValues>({
    // Empty text inputs are "", the contract wants them absent.
    resolver: (values, context, options) => baseResolver(mapBlanks(values, OPTIONAL_TEXT, undefined), context, options),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      type: "physical",
      addressLine: "",
      city: "",
      region: "",
      postalCode: "",
      countryCode: "",
      createDefaultLocation: true,
    },
  })
  const type = useWatch({ control: form.control, name: "type" })
  const isVirtual = type === "virtual"

  // A virtual warehouse has no address: drop anything typed before switching the type.
  useEffect(() => {
    if (isVirtual) for (const key of ADDRESS_KEYS) form.setValue(key, "")
  }, [isVirtual, form])

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <InputField control={form.control} name="code" copy={copy.code} type="text" autoComplete="off" autoFocus disabled={isPending} />
        <InputField control={form.control} name="name" copy={copy.name} type="text" autoComplete="off" disabled={isPending} />
        <SelectField control={form.control} name="type" copy={copy.type} options={copy.typeOptions} disabled={isPending} />
        <InputField control={form.control} name="description" copy={copy.warehouseDescription} type="text" autoComplete="off" disabled={isPending} />

        {isVirtual ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <InputField control={form.control} name="addressLine" copy={copy.addressLine} type="text" autoComplete="off" disabled={isPending} />
            </div>
            <InputField control={form.control} name="city" copy={copy.city} type="text" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="region" copy={copy.region} type="text" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="postalCode" copy={copy.postalCode} type="text" autoComplete="off" disabled={isPending} />
            <InputField control={form.control} name="countryCode" copy={copy.countryCode} type="text" autoComplete="off" disabled={isPending} />
          </div>
        )}

        <CheckboxRow
          control={form.control}
          name="createDefaultLocation"
          label={copy.createDefaultLocation.label}
          description={copy.createDefaultLocation.description}
          disabled={isPending}
        />

        <SubmitButton className="w-full" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
