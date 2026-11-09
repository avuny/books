import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"

import { ItemFields } from "./item-fields"
import {
  CreateItemFormSchema,
  getCreateItemDefaults,
  type CreateItemFormInput,
  type CreateItemFormValues,
} from "./item-form-schema"
import type { ItemFormCopy, ItemPickers, ValuationOption } from "./item-form-types"

export type { CreateItemFormValues }

type CreateItemFormProps = {
  copy: ItemFormCopy
  pickers: ItemPickers
  valuationOptions: ValuationOption[]
  defaultName?: string
  onSubmit: (values: CreateItemFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateItemForm({
  copy,
  pickers,
  valuationOptions,
  defaultName,
  onSubmit,
  isPending,
  errorMessage,
}: CreateItemFormProps) {
  const form = useForm<CreateItemFormInput, unknown, CreateItemFormValues>({
    resolver: zodResolver(CreateItemFormSchema),
    defaultValues: getCreateItemDefaults(defaultName),
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <ItemFields
          control={form.control}
          copy={copy}
          pickers={pickers}
          valuationOptions={valuationOptions}
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
