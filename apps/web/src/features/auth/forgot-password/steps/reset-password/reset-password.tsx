import { useState } from "react"
import { useTranslation } from "react-i18next"
import { OtpErrorCode } from "@avuny/contracts"
import { AuthErrorCode } from "@avuny/contracts/user"

import { useForgotPasswordReset } from "@/api"
import { parseApiError } from "@/features/auth/lib/api-error"
import {
  ResetPasswordForm,
  type ResetPasswordFormValues,
} from "./reset-password-form"

type ResetPasswordProps = {
  verificationToken: string
  /** Proof rejected/expired: the flow should restart from step one. */
  onProofInvalid: () => void
  /** Password changed. The API signs nobody in, so there is no payload. */
  onSuccess?: () => void
}

// Composition only: strings + API behavior wired into the pure form.
export function ResetPassword({
  verificationToken,
  onProofInvalid,
  onSuccess,
}: ResetPasswordProps) {
  const { t } = useTranslation("user")
  const resetMutation = useForgotPasswordReset()
  const [serverError, setServerError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const copy = {
    title: t("auth.forgotPassword.resetPassword.title"),
    description: t("auth.forgotPassword.resetPassword.description"),
    newPassword: {
      label: t("auth.forgotPassword.resetPassword.newPassword.label"),
      placeholder: t(
        "auth.forgotPassword.resetPassword.newPassword.placeholder"
      ),
    },
    confirmPassword: {
      label: t("auth.forgotPassword.resetPassword.confirmPassword.label"),
      placeholder: t(
        "auth.forgotPassword.resetPassword.confirmPassword.placeholder"
      ),
    },
    passwordMismatchMessage: t(
      "auth.forgotPassword.resetPassword.passwordMismatch"
    ),
    submitLabel: t("auth.forgotPassword.resetPassword.submitLabel"),
    submittingLabel: t("auth.forgotPassword.resetPassword.submittingLabel"),
  }

  // Called only when Zod validation passes.
  const handleSubmit = async ({ newPassword }: ResetPasswordFormValues) => {
    setServerError(null)
    setPasswordError(null)
    try {
      await resetMutation.mutateAsync({
        data: { verificationToken, newPassword },
      })
      onSuccess?.()
    } catch (e) {
      const parsed = parseApiError(e)
      if (parsed.code === OtpErrorCode.VERIFICATION_TOKEN_INVALID) {
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
    <ResetPasswordForm
      copy={copy}
      onSubmit={handleSubmit}
      isPending={resetMutation.isPending}
      errorMessage={serverError}
      passwordError={passwordError}
    />
  )
}
