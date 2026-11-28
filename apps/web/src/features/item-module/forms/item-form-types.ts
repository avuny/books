import type { FieldCopy } from "@workspace/ui/blocks/types"
import type {
  AsyncComboboxCopy,
  AsyncOptionsSource,
  ComboboxCreateAction,
  ComboboxEditAction,
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
  unitExclusive?: string
  canAssembled: FieldCopy
  isReturnable: FieldCopy
  isInventoryTracked: FieldCopy
  isBatchTracked: FieldCopy
  isExpiryTracked: FieldCopy
  shelfLifeValue: FieldCopy
  shelfLifeUnit: FieldCopy
  valuationMethod: FieldCopy
  allowNegativeStock: FieldCopy
  reorderPoint: FieldCopy
  costPrice: FieldCopy
  sellingPrice: FieldCopy
  isActive: FieldCopy
  submitLabel: string
  submittingLabel: string
  steps: {
    /** "Step {current} of {total}" */
    stepLabel: string
    details: string
    prices: string
    stock: string
    next: string
    back: string
    descriptionDetails: string
    descriptionPrices: string
    descriptionStock: string
  }
  unitPrices: {
    sectionTitle: string
    sectionDescription: string
    /** "{unit} (base unit)" */
    baseUnitTitle: string
    /** "{unit}" */
    unitTitle: string
    noOtherUnits: string
    costPrice: FieldCopy
    sellingPrice: FieldCopy
  }
  openingStock: {
    sectionTitle: string
    sectionDescription: string
    addLine: string
    removeLine: string
    empty: string
    linesHeader: string
    line: {
      location: FieldCopy
      unit: FieldCopy
      quantity: FieldCopy
      cost: FieldCopy
      postedAt: FieldCopy
    }
    batch: {
      toggle: string
      number: FieldCopy
      manufacturedOn: FieldCopy
      expiresOn: FieldCopy
    }
  }
}

/** Everything one async combobox needs, injected by the composition component. */
export type ItemCombobox = {
  copy: AsyncComboboxCopy
  source: AsyncOptionsSource
  /** Omit to hide the "Create new" footer. */
  createAction?: ComboboxCreateAction
  /** Omit to hide the edit icon on items. */
  editAction?: ComboboxEditAction
  /** Edit forms: the current value, so its name shows before the list loads. */
  initialOption?: { id: string; name: string } | null
}

export type ItemPickers = {
  category: ItemCombobox
  unitCollection: ItemCombobox
  baseUnit?: ItemCombobox
  openingStockLocation: ItemCombobox
}

export type ValuationOption = { value: string; label: string }
export type ShelfLifeUnitOption = { value: string; label: string }

/** One unit of the selected unit collection, as the price and opening stock fields need it. */
export type CollectionUnitOption = {
  id: string
  name: string
  symbol: string
  /** Base units that one of this unit equals ("1" for the base unit). */
  factor: string
  isBase: boolean
}
