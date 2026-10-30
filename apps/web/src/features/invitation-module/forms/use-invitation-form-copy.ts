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
    type: {
      legend: t("fields.type.legend"),
      options: {
        managed: {
          label: t("types.managed"),
          description: t("fields.type.descriptions.managed"),
        },
        portal: {
          label: t("types.portal"),
          description: t("fields.type.descriptions.portal"),
        },
      },
    },
    channel: {
      legend: t("fields.channel.legend"),
      options: {
        email: { label: t("labels.email") },
        whatsapp: { label: t("labels.whatsapp") },
      },
    },
    email: {
      label: t("fields.email.label"),
      placeholder: t("fields.email.placeholder"),
    },
    phone: {
      label: t("fields.phone.label"),
      placeholder: t("fields.phone.placeholder"),
    },
    username: {
      label: t("fields.username.label"),
      placeholder: t("fields.username.placeholder"),
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
