import { useTranslation } from "react-i18next"

import type { ErrorMessageMap } from "@workspace/ui/lib/api-error"

import type { SignInCopy } from "./sign-in-form"

// Explicit keys (no template strings) so they stay greppable and extractable.
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

/** Keys are API error codes from @avuny/contracts. `fallback` is required. */
export function useSignInErrors(): ErrorMessageMap {
  const { t } = useTranslation("user")
  return {
    fallback: t("auth.errors.fallback"),
    INVALID_CREDENTIALS: t("auth.errors.INVALID_CREDENTIALS"),
  }
}
