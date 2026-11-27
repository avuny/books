import { roleErrorsHttpMap } from "../role/index.js"
import { salesCreditNoteErrorsHttpMap } from "./sales-credit-note.errors.js"

export const salesCreditNoteErrorMap = {
  ...salesCreditNoteErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
