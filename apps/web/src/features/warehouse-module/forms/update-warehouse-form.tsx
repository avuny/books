import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { UpdateWarehouseSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import type { UpdateWarehouseInput, WarehouseDto } from "../types"
import type { WarehouseFormCopy } from "./warehouse-form-types"

import type { z } from "@avuny/zod"

export type UpdateWarehouseFormValues = UpdateWarehouseInput
type UpdateWarehouseFormInput = z.input<typeof UpdateWarehouseSchema>

// Clearing a text field sends null so the stored value is removed.
const NULLABLE_TEXT = ["description", "addressLine", "city", "region", "postalCode", "countryCode"] as const

type UpdateWarehouseFormProps = {
  copy: WarehouseFormCopy
  warehouse: WarehouseDto
  onSubmit: (values: UpdateWarehouseFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

const baseResolver = zodResolver(UpdateWarehouseSchema)

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateWarehouseForm({ copy, warehouse, onSubmit, isPending, errorMessage }: UpdateWarehouseFormProps) {
  const form = useForm<UpdateWarehouseFormInput, unknown, UpdateWarehouseFormValues>({
    resolver: (values, context, options) => baseResolver(mapBlanks(values, NULLABLE_TEXT, null), context, options),
    defaultValues: {
      code: warehouse.code,
      name: warehouse.name,
      description: warehouse.description ?? "",
      addressLine: warehouse.addressLine ?? "",
      city: warehouse.city ?? "",
      region: warehouse.region ?? "",
      postalCode: warehouse.postalCode ?? "",
      countryCode: warehouse.countryCode ?? "",
    },
  })
  const isVirtual = warehouse.type === "virtual" // the type is immutable; a virtual warehouse has no address

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <InputField control={form.control} name="code" copy={copy.code} type="text" autoComplete="off" autoFocus disabled={isPending} />
        <InputField control={form.control} name="name" copy={copy.name} type="text" autoComplete="off" disabled={isPending} />
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

        <SubmitButton className="w-full" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
