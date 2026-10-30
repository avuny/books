import { blankToUndefined, normalizePhone } from "../lib"
import type { InvitableMemberType, InvitationChannel } from "../types"

/**
 * What the inputs hold: text fields are always strings ("" when empty). The
 * `to…Input` functions below turn them into the contract shape before validation.
 */
export type CreateInvitationFormValues = {
  type: InvitableMemberType
  channel: InvitationChannel
  email: string
  phone: string
  username: string
}

export const CREATE_INVITATION_DEFAULTS: CreateInvitationFormValues = {
  type: "managed",
  channel: "email",
  email: "",
  phone: "",
  username: "",
}

/** Blanks become undefined, and only the contact the chosen channel needs is sent. */
export function toCreateInvitationInput(values: CreateInvitationFormValues) {
  return {
    type: values.type,
    channel: values.channel,
    email: values.channel === "email" ? blankToUndefined(values.email) : undefined,
    phone:
      values.channel === "whatsapp"
        ? blankToUndefined(normalizePhone(values.phone))
        : undefined,
    username: blankToUndefined(values.username),
  }
}

export type AcceptInvitationFormValues = {
  username: string
}

export function toAcceptInvitationInput(values: AcceptInvitationFormValues) {
  return { username: blankToUndefined(values.username) }
}
