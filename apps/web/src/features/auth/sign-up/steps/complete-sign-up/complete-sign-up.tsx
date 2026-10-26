import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AuthErrorCode, type AuthResponse } from "@avuny/contracts/user"

import { useSignUp } from "@/api"
import { useAuthSuccessHandler } from "@/features/auth"
import { parseApiError } from "@/features/auth/lib/api-error"
import {
  CompleteSignUpForm,
  type CompleteSignUpFormValues,
} from "./complete-sign-up-form"

type CompleteSignUpProps = {
  identifier: string
  verificationToken: string
  /** Proof rejected/expired: the flow should restart from step one. */
  onProofInvalid: () => void
  onSuccess?: (data: AuthResponse) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CompleteSignUp({
  identifier,
  verificationToken,
  onProofInvalid,
  onSuccess,
}: CompleteSignUpProps) {
  const handleAuthSuccess = useAuthSuccessHandler()
  const { t } = useTranslation("user")
  const signUpMutation = useSignUp()
  const [serverError, setServerError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const copy = {
    title: t("auth.signUp.completeSignUp.title"),
    description: t("auth.signUp.completeSignUp.description"),
    name: {
      label: t("auth.signUp.completeSignUp.name.label"),
      placeholder: t("auth.signUp.completeSignUp.name.placeholder"),
    },
    password: {
      label: t("auth.signUp.completeSignUp.password.label"),
      placeholder: t("auth.signUp.completeSignUp.password.placeholder"),
    },
    confirmPassword: {
      label: t("auth.signUp.completeSignUp.confirmPassword.label"),
      placeholder: t("auth.signUp.completeSignUp.confirmPassword.placeholder"),
    },
    passwordMismatchMessage: t("auth.signUp.completeSignUp.passwordMismatch"),
    submitLabel: t("auth.signUp.completeSignUp.submitLabel"),
    submittingLabel: t("auth.signUp.completeSignUp.submittingLabel"),
  }

  // Called only when Zod validation passes.
  const handleSubmit = async ({ name, password }: CompleteSignUpFormValues) => {
    setServerError(null)
    setPasswordError(null)
    try {
      const data = await signUpMutation.mutateAsync({
        data: { identifier, name, password, verificationToken },
      })
      handleAuthSuccess(data)
      onSuccess?.(data.data)
    } catch (e) {
      const parsed = parseApiError(e)
      if (parsed.code === AuthErrorCode.INVALID_CREDENTIALS) {
        onProofInvalid()
        return
      }
      if (parsed.code === AuthErrorCode.WEAK_PASSWORD) {
        setPasswordError(parsed.message || null)
        return
      }
      setServerError(parsed.message || null)
    }
  }

  return (
    <CompleteSignUpForm
      copy={copy}
      onSubmit={handleSubmit}
      isPending={signUpMutation.isPending}
      errorMessage={serverError}
      passwordError={passwordError}
    />
  )
}
