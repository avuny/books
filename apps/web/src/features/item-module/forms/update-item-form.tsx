import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type Control } from "react-hook-form"

import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"

import type { ItemDto } from "../types"
import { ItemFields } from "./item-fields"
import {
  UpdateItemFormSchema,
  getUpdateItemDefaults,
  type CreateItemFormInput,
  type UpdateItemFormInput,
  type UpdateItemFormValues,
} from "./item-form-schema"
import type { ItemFormCopy, ItemPickers, ValuationOption } from "./item-form-types"

export type { UpdateItemFormValues }

type UpdateItemFormProps = {
  copy: ItemFormCopy
  pickers: ItemPickers
  valuationOptions: ValuationOption[]
  /** The item being edited; its values pre-fill the form. */
  item: ItemDto
  onSubmit: (values: UpdateItemFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateItemForm({
  copy,
  pickers,
  valuationOptions,
  item,
  onSubmit,
  isPending,
  errorMessage,
}: UpdateItemFormProps) {
  const form = useForm<UpdateItemFormInput, unknown, UpdateItemFormValues>({
    resolver: zodResolver(UpdateItemFormSchema),
    defaultValues: getUpdateItemDefaults(item),
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <ItemFields
          // Create and update inputs have the same shape (the collection field is just never shown).
          control={form.control as unknown as Control<CreateItemFormInput, any, any>}
          copy={copy}
          pickers={pickers}
          valuationOptions={valuationOptions}
          showIsActive
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
