import type { FieldCopy } from "@workspace/ui/blocks/types"

/** Localized strings for the create-invitation form. */
export type InvitationFormCopy = {
  title: string
  description: string
  identifier: FieldCopy
  role: FieldCopy
  submitLabel: string
  submittingLabel: string
}

/** Localized strings for the accept form (inbox dialog and link page). */
export type AcceptInvitationFormCopy = {
  username?: FieldCopy
  submitLabel: string
  submittingLabel: string
}
