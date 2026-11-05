import type { CreateOrganizationInvitationInput } from "../types"

export type CreateInvitationFormValues = {
  identifier: string
  roleId: string
}

export const CREATE_INVITATION_DEFAULTS: CreateInvitationFormValues = {
  identifier: "",
  roleId: "",
}

export function toCreateInvitationInput(
  values: CreateInvitationFormValues
): CreateOrganizationInvitationInput {
  return {
    identifier: values.identifier.trim().toLowerCase(),
    roleId: values.roleId.trim(),
  }
}

export type AcceptInvitationFormValues = {
  username?: string
}

export function toAcceptInvitationInput(_values: AcceptInvitationFormValues) {
  return {}
}
