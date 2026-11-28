import type { FieldCopy } from "@workspace/ui/blocks/types"

export type OptionItem = {
  value: string
  label: string
  direction?: string
  code?: string
}

export type InventoryAdjustmentFormCopy = {
  title: string
  description: string
  referenceNumber: FieldCopy
  date: FieldCopy
  warehouse: FieldCopy
  direction: {
    label: string
    decrease: string
    increase: string
    both: string
  }
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
    newBatch?: string
    countedQuantity: FieldCopy
    unitCost: FieldCopy
    zeroCostReason: FieldCopy
    zeroCostReasons: { value: string; label: string }[]
    systemQuantity: string
    difference: string
    notes: FieldCopy
  }
  submitDraftLabel: string
  submittingDraftLabel: string
  submitConfirmLabel: string
  submittingConfirmLabel: string
  confirmDialogTitle: string
  confirmDialogDescription: string
  cancelLabel: string
}
