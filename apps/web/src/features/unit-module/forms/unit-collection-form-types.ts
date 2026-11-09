import type { FieldCopy } from "@workspace/ui/blocks/types"
import type { AsyncComboboxCopy, AsyncOptionsSource } from "@workspace/ui/blocks/form"

export type UnitCollectionExtraUnitsCopy = {
  label: string
  description: string
  /** Shown when the collection has no other units. */
  empty: string
  add: string
  remove: string
  /** Shown instead of the "add" button until the base unit is chosen. */
  pickBaseFirst: string
  unit: FieldCopy
  conversionFactor: FieldCopy
}

/** Localized strings shared by the create and update forms. */
export type UnitCollectionFormCopy = {
  title: string
  description: string
  name: FieldCopy
  baseUnit: FieldCopy
  /** Update only: why the base unit is shown as plain text. */
  baseUnitLocked: string
  extraUnits: UnitCollectionExtraUnitsCopy
  submitLabel: string
  submittingLabel: string
}

/** Combobox pieces for one unit picker, injected by the composition component. */
export type UnitPicker = {
  copy: AsyncComboboxCopy
  source: AsyncOptionsSource
}

/** Known option labels, so existing rows show a name before the list is opened. */
export type UnitInitialOptions = Record<string, { id: string; name: string }>
