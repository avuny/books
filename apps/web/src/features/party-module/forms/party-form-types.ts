import type { FieldCopy } from "@workspace/ui/blocks/types"
import type { PartyType, PartySalutation } from "../types.js"

export interface PartyFormCopy {
  title: string
  description: string
  partyType: FieldCopy & { options: { value: PartyType; label: string }[] }
  salutation: FieldCopy & { options: { value: PartySalutation; label: string }[] }
  displayName: FieldCopy
  legalName: FieldCopy
  taxNumber: FieldCopy
  website: FieldCopy
  notes: FieldCopy
  alsoAddOpposite: {
    label: string
  }
  emails: {
    title: string
    add: string
    remove: string
    primary: string
    email: FieldCopy
    label: FieldCopy
  }
  phones: {
    title: string
    add: string
    remove: string
    primary: string
    phone: FieldCopy
    label: FieldCopy
  }
  addresses: {
    title: string
    add: string
    remove: string
    primary: string
    label: FieldCopy
    addressLine1: FieldCopy
    addressLine2: FieldCopy
    city: FieldCopy
    state: FieldCopy
    postalCode: FieldCopy
    countryCode: FieldCopy
  }
  submitLabel: string
  submittingLabel: string
  cancelLabel: string
}
