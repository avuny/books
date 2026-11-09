import type { FieldCopy } from "@workspace/ui/blocks/types"
import type { AsyncComboboxCopy, AsyncOptionsSource } from "@workspace/ui/blocks/form"

/** Localized strings shared by the create and update forms. */
export type ItemCategoryFormCopy = {
  title: string
  description: string
  name: FieldCopy
  categoryDescription: FieldCopy
  parent: FieldCopy
  isActive: FieldCopy
  submitLabel: string
  submittingLabel: string
}

/** Everything the parent-category combobox needs, injected by the composition component. */
export type ItemCategoryParentPicker = {
  copy: AsyncComboboxCopy
  source: AsyncOptionsSource
  /** Edit forms: the current parent, so its name shows before the list loads. */
  initialOption?: { id: string; name: string } | null
}
