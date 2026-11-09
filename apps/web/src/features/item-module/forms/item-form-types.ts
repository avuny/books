import type { FieldCopy } from "@workspace/ui/blocks/types"
import type {
  AsyncComboboxCopy,
  AsyncOptionsSource,
  ComboboxCreateAction,
} from "@workspace/ui/blocks/form"

/** Localized strings shared by the create and update forms. */
export type ItemFormCopy = {
  title: string
  description: string
  name: FieldCopy
  itemDescription: FieldCopy
  category: FieldCopy
  baseUnit: FieldCopy
  unitCollection: FieldCopy
  /** Shown when both a base unit and a collection are picked. */
  unitExclusive: string
  canAssembled: FieldCopy
  isReturnable: FieldCopy
  isInventoryTracked: FieldCopy
  isBatchTracked: FieldCopy
  valuationMethod: FieldCopy
  allowNegativeStock: FieldCopy
  reorderPoint: FieldCopy
  isActive: FieldCopy
  submitLabel: string
  submittingLabel: string
}

/** Everything one async combobox needs, injected by the composition component. */
export type ItemCombobox = {
  copy: AsyncComboboxCopy
  source: AsyncOptionsSource
  /** Omit to hide the "Create new" footer. */
  createAction?: ComboboxCreateAction
  /** Edit forms: the current value, so its name shows before the list loads. */
  initialOption?: { id: string; name: string } | null
}

export type ItemPickers = {
  category: ItemCombobox
  baseUnit: ItemCombobox
  /** Create form only: reuse an existing collection instead of picking a base unit. */
  unitCollection?: ItemCombobox
}

export type ValuationOption = { value: string; label: string }
