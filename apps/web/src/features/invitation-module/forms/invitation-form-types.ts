import type { FieldCopy } from "@workspace/ui/blocks/types"

import type { InvitableMemberType, InvitationChannel } from "../types"

export type InvitationChoiceCopy<T extends string> = {
  legend: string
  options: Record<T, { label: string; description?: string }>
}

/** Localized strings for the create-invitation form. */
export type InvitationFormCopy = {
  title: string
  description: string
  type: InvitationChoiceCopy<InvitableMemberType>
  channel: InvitationChoiceCopy<InvitationChannel>
  email: FieldCopy
  phone: FieldCopy
  username: FieldCopy
  submitLabel: string
  submittingLabel: string
}

/** Localized strings for the accept form (inbox dialog and link page). */
export type AcceptInvitationFormCopy = {
  username: FieldCopy
  submitLabel: string
  submittingLabel: string
}
