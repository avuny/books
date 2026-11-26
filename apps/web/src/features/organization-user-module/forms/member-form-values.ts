/** What the inputs hold: text fields are always strings ("" when empty). */
export type EditMemberFormValues = {
  username: string
}

/** The schema trims and lowercases the username itself. */
export function toEditMemberInput(values: EditMemberFormValues) {
  return { username: values.username }
}

export type TransferOwnershipFormValues = {
  confirmCode: string
}

/** The target member comes from the row, not from an input. */
export const toTransferOwnershipInput =
  (newOwnerMemberId: string) => (values: TransferOwnershipFormValues) => ({
    newOwnerMemberId,
    confirmCode: values.confirmCode,
  })
