import { useTranslation } from "react-i18next"

import type {
  EditMemberFormCopy,
  TransferOwnershipFormCopy,
} from "./member-form-types"

/** Builds the localized strings for the edit-username form. */
export function useEditMemberFormCopy(): EditMemberFormCopy {
  const { t } = useTranslation("organization-user")

  return {
    username: {
      label: t("fields.username.label"),
      placeholder: t("fields.username.placeholder"),
    },
    submitLabel: t("edit.submitLabel"),
    submittingLabel: t("edit.submittingLabel"),
  }
}

/** Builds the localized strings for the transfer-ownership form. */
export function useTransferOwnershipFormCopy(): TransferOwnershipFormCopy {
  const { t } = useTranslation("organization-user")

  return {
    confirmCode: {
      label: t("fields.confirmCode.label"),
      placeholder: t("fields.confirmCode.placeholder"),
    },
    submitLabel: t("transfer.submitLabel"),
    submittingLabel: t("transfer.submittingLabel"),
  }
}
