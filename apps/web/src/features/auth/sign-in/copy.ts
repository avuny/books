import { useTranslation } from "react-i18next"
import type { ErrorMessages } from "@workspace/ui/blocks/types"
import type { SignInCopy } from "./types"

export function useSignInCopy(): SignInCopy {
  const { t } = useTranslation("user")
  return {
    title: t("auth.signIn.title"),
    description: t("auth.signIn.description"),
    identifier: {
      label: t("auth.signIn.identifier.label"),
      placeholder: t("auth.signIn.identifier.placeholder"),
    },
    password: {
      label: t("auth.signIn.password.label"),
      placeholder: t("auth.signIn.password.placeholder"),
    },
    submitLabel: t("auth.signIn.submitLabel"),
    submittingLabel: t("auth.signIn.submittingLabel"),
    signUpPrompt: t("auth.signIn.signUpPrompt"),
    signUpLabel: t("auth.signIn.signUpLabel"),
  }
}

/** Keys are API error codes from @avuny/contracts. */
export function useSignInErrors(): ErrorMessages {
  const { t } = useTranslation("user")
  return {
    fallback: t("auth.errors.fallback"),
    INVALID_CREDENTIALS: t("auth.errors.INVALID_CREDENTIALS"),
  }
}
