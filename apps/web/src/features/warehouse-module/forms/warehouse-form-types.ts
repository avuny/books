import type { FieldCopy } from "@workspace/ui/blocks/types"

/** Localized strings shared by the create and update forms. */
export type WarehouseFormCopy = {
  title: string
  description: string
  code: FieldCopy
  name: FieldCopy
  /** Not "description": clashes with the form description above. */
  warehouseDescription: FieldCopy
  type: FieldCopy
  addressLine: FieldCopy
  city: FieldCopy
  region: FieldCopy
  postalCode: FieldCopy
  countryCode: FieldCopy
  createDefaultLocation: { label: string; description: string }
  typeOptions: { value: string; label: string }[]
  submitLabel: string
  submittingLabel: string
}
