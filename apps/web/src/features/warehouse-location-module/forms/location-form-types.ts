import type { FieldCopy } from "@workspace/ui/blocks/types"

type FlagCopy = { label: string; description: string }

/** Localized strings shared by the create and update location forms. */
export type LocationFormCopy = {
  title: string
  description: string
  /** `fixed` introduces a parent that cannot be changed ("Inside …"). */
  parent: FieldCopy & { fixed: string }
  code: FieldCopy & { suggest: string }
  name: FieldCopy
  type: FieldCopy
  purpose: FieldCopy
  isStockable: FlagCopy
  isPickable: FlagCopy
  isReceivable: FlagCopy
  applyToDescendants: FlagCopy
  measures: {
    title: string
    width: FieldCopy
    height: FieldCopy
    depth: FieldCopy
    maxWeight: FieldCopy
    maxVolume: FieldCopy
  }
  purposeOptions: { value: string; label: string }[]
  submitLabel: string
  submittingLabel: string
}

/** Copy of the small single-purpose dialogs (move, block, barcode). */
export type LocationActionFormCopy = {
  title: string
  description: string
  submitLabel: string
  submittingLabel: string
}

export type LocationBulkFormCopy = LocationActionFormCopy & {
  parent: FieldCopy & { fixed: string }
  preview: string
  previewing: string
  /** Already interpolated: "Locations to create: 284". */
  total: (count: number) => string
  created: (count: number) => string
  tooMany: string
  badOrder: string
  examples: string
  level: (number: number) => string
  levelFields: { type: string; prefix: string; start: string; count: string; pad: string; add: string; remove: string }
}
