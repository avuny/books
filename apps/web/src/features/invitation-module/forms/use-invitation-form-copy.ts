import { useTranslation } from "react-i18next"

import type {
  AcceptInvitationFormCopy,
  InvitationFormCopy,
} from "./invitation-form-types"

/** Builds the localized strings for the create-invitation form. */
export function useInvitationFormCopy(): InvitationFormCopy {
  const { t } = useTranslation("organization-invitation")

  return {
    title: t("create.title"),
    description: t("create.description"),
    identifier: {
      label: t("fields.identifier.label"),
      placeholder: t("fields.identifier.placeholder"),
    },
    role: {
      label: t("fields.role.label"),
      placeholder: t("fields.role.placeholder"),
    },
    submitLabel: t("create.submitLabel"),
    submittingLabel: t("create.submittingLabel"),
  }
}

/** Builds the localized strings for the accept form. */
export function useAcceptInvitationFormCopy(): AcceptInvitationFormCopy {
  const { t } = useTranslation("organization-invitation")

  return {
    username: {
      label: t("fields.acceptUsername.label"),
      placeholder: t("fields.acceptUsername.placeholder"),
    },
    submitLabel: t("accept.submitLabel"),
    submittingLabel: t("accept.submittingLabel"),
  }
}
