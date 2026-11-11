import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"

import type { ItemCategoryDto } from "../types"
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

export type UpdateItemCategoryFormValues = ItemCategoryFormValues

type UpdateItemCategoryFormProps = {
  copy: ItemCategoryFormCopy
  parent: ItemCategoryParentPicker
  /** The category being edited; its values pre-fill the form. */
  category: ItemCategoryDto
  onSubmit: (values: UpdateItemCategoryFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateItemCategoryForm({
  copy,
  parent,
  category,
  onSubmit,
  isPending,
  errorMessage,
}: UpdateItemCategoryFormProps) {
  const form = useForm<ItemCategoryFormInput, unknown, ItemCategoryFormValues>({
    resolver: zodResolver(ItemCategoryFormSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
      isActive: category.isActive,
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
