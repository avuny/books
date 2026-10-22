import { useTranslation } from "react-i18next"
import type { ErrorMessages, SignUpCopy } from "./types"

export function useSignUpCopy(): SignUpCopy {
  const { t } = useTranslation("user")
  return {
    stepLabel: t("auth.signUp.stepLabel"),
    identifier: {
      title: t("auth.signUp.identifier.title"),
      description: t("auth.signUp.identifier.description"),
      field: {
        label: t("auth.signUp.identifier.field.label"),
        placeholder: t("auth.signUp.identifier.field.placeholder"),
      },
      submitLabel: t("auth.signUp.identifier.submitLabel"),
      submittingLabel: t("auth.signUp.identifier.submittingLabel"),
    },
    verify: {
      title: t("auth.signUp.verify.title"),
      description: t("auth.signUp.verify.description"),
      codeLabel: t("auth.signUp.verify.codeLabel"),
      submitLabel: t("auth.signUp.verify.submitLabel"),
      submittingLabel: t("auth.signUp.verify.submittingLabel"),
      resendCountdownLabel: t("auth.signUp.verify.resendCountdownLabel"),
      resendLabel: t("auth.signUp.verify.resendLabel"),
      resendingLabel: t("auth.signUp.verify.resendingLabel"),
      resendCounterLabel: t("auth.signUp.verify.resendCounterLabel"),
      changeIdentifierLabel: t("auth.signUp.verify.changeIdentifierLabel"),
    },
    register: {
      title: t("auth.signUp.register.title"),
      description: t("auth.signUp.register.description"),
      name: {
        label: t("auth.signUp.register.name.label"),
        placeholder: t("auth.signUp.register.name.placeholder"),
      },
      password: {
        label: t("auth.signUp.register.password.label"),
        placeholder: t("auth.signUp.register.password.placeholder"),
      },
      confirmPassword: {
        label: t("auth.signUp.register.confirmPassword.label"),
        placeholder: t("auth.signUp.register.confirmPassword.placeholder"),
      },
      passwordMismatchMessage: t("auth.signUp.register.passwordMismatchMessage"),
      submitLabel: t("auth.signUp.register.submitLabel"),
      submittingLabel: t("auth.signUp.register.submittingLabel"),
    },
  }
}

/** Keys are the API error codes from @avuny/contracts. */
export function useSignUpErrors(): ErrorMessages {
  const { t } = useTranslation("user")
  return {
    fallback: t("auth.errors.fallback"),
    OTP_INVALID: t("auth.errors.OTP_INVALID"),
    OTP_EXPIRED: t("auth.errors.OTP_EXPIRED"),
    OTP_ATTEMPTS_EXCEEDED: t("auth.errors.OTP_ATTEMPTS_EXCEEDED"),
    OTP_RATE_LIMITED: t("auth.errors.OTP_RATE_LIMITED"),
    OTP_RESEND_TOO_SOON: t("auth.errors.OTP_RESEND_TOO_SOON"),
    VERIFICATION_TOKEN_INVALID: t("auth.errors.VERIFICATION_TOKEN_INVALID"),
    WEAK_PASSWORD: t("auth.errors.WEAK_PASSWORD"),
    INVALID_IDENTIFIER_TYPE: t("auth.errors.INVALID_IDENTIFIER_TYPE"),
    proofExpired: t("auth.errors.proofExpired"),
  }
}
