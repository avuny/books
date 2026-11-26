import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"

import { ItemCategoryFields } from "./item-category-fields"
import {
  ItemCategoryFormSchema,
  type ItemCategoryFormInput,
  type ItemCategoryFormValues,
} from "./item-category-form-schema"
import type {
  ItemCategoryFormCopy,
  ItemCategoryParentPicker,
} from "./item-category-form-types"

export type CreateItemCategoryFormValues = ItemCategoryFormValues

type CreateItemCategoryFormProps = {
  copy: ItemCategoryFormCopy
  parent: ItemCategoryParentPicker
  defaultName?: string
  onSubmit: (values: CreateItemCategoryFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateItemCategoryForm({
  copy,
  parent,
  defaultName,
  onSubmit,
  isPending,
  errorMessage,
}: CreateItemCategoryFormProps) {
  const form = useForm<ItemCategoryFormInput, unknown, ItemCategoryFormValues>({
    resolver: zodResolver(ItemCategoryFormSchema),
    defaultValues: {
      name: defaultName ?? "",
      description: "",
      parentId: "",
      isActive: true,
    },
  })

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <ItemCategoryFields
          control={form.control}
          copy={copy}
          parent={parent}
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
