import type { FieldCopy } from "@workspace/ui/blocks/types"

export type OptionItem = {
  value: string
  label: string
}

export type InventoryAdjustmentFormCopy = {
  title: string
  description: string
  referenceNumber: FieldCopy
  date: FieldCopy
  warehouse: FieldCopy
  reason: FieldCopy
  formDescription: FieldCopy
  linesTitle: string
  addLine: string
  removeLine: string
  noLines: string
  fields: {
    item: FieldCopy
    location: FieldCopy
    unit: FieldCopy
    batch: FieldCopy
    countedQuantity: FieldCopy
    systemQuantity: string
    difference: string
    notes: FieldCopy
  }
  submitDraftLabel: string
  submittingDraftLabel: string
  submitConfirmLabel: string
  submittingConfirmLabel: string
}
