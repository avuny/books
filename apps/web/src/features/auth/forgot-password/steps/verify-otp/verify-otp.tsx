import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { z } from "@avuny/zod"
import { OtpErrorCode } from "@avuny/contracts"
import type { VerifyOtpResponseSchema } from "@avuny/contracts/user"

import { useForgotPasswordSendOtp, useVerifyOtp } from "@/api"
import { fill, parseApiError, unwrap } from "@/features/auth/lib/api-error"
import type { OtpChallenge } from "@/features/auth/types"
import { useCountdown } from "./use-countdown"
import { VerifyOtpForm, type VerifyOtpFormValues } from "./verify-otp-form"

type VerifyOtpProps = {
  identifier: string
  challenge: OtpChallenge
  resendCount: number
  /** Optional client-side cap on resends (the server enforces its own). */
  maxResends?: number
  onVerified: (verificationToken: string) => void
  onResent: (challenge: OtpChallenge) => void
  /** Sends the user back to the first step. */
  onChangeIdentifier: () => void
}

// Composition only: strings + API behavior wired into the pure form.
export function VerifyOtp({
  identifier,
  challenge,
  resendCount,
  maxResends,
  onVerified,
  onResent,
  onChangeIdentifier,
}: VerifyOtpProps) {
  const { t } = useTranslation("user")
  const verifyMutation = useVerifyOtp()
  const resendMutation = useForgotPasswordSendOtp()
  const [serverError, setServerError] = useState<string | null>(null)
  // Expired / too many attempts: the code is dead, only a resend can recover.
  const [locked, setLocked] = useState(false)
  // Bumped to remount the form: clears the code and refocuses the field.
  const [formKey, setFormKey] = useState(0)
  const secondsLeft = useCountdown(challenge.resendAvailableAt)

  const limitReached = maxResends !== undefined && resendCount >= maxResends
  const canResend =
    secondsLeft === 0 && !resendMutation.isPending && !limitReached

  const copy = {
    title: t("auth.forgotPassword.verifyOtp.title"),
    description: fill(t("auth.forgotPassword.verifyOtp.description"), {
      identifier,
    }),
    codeLabel: t("auth.forgotPassword.verifyOtp.codeLabel"),
    submitLabel: t("auth.forgotPassword.verifyOtp.submitLabel"),
    submittingLabel: t("auth.forgotPassword.verifyOtp.submittingLabel"),
    resendPrompt: t("auth.forgotPassword.verifyOtp.resendPrompt"),
    resendLabel: t("auth.forgotPassword.verifyOtp.resendLabel"),
    resendIn: fill(t("auth.forgotPassword.verifyOtp.resendIn"), {
      seconds: String(secondsLeft),
    }),
    resendLimitReached: t("auth.forgotPassword.verifyOtp.resendLimitReached"),
    changeIdentifierLabel: t(
      "auth.forgotPassword.verifyOtp.changeIdentifierLabel"
    ),
  }

  // Called only when Zod validation passes.
  const handleSubmit = async ({ code }: VerifyOtpFormValues) => {
    if (locked) return
    setServerError(null)
    try {
      const res = await verifyMutation.mutateAsync({
        data: { challengeId: challenge.challengeId, code },
      })
      onVerified(
        unwrap<z.infer<typeof VerifyOtpResponseSchema>>(res).verificationToken
      )
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || null)
      setFormKey((k) => k + 1)
      if (
        parsed.code === OtpErrorCode.OTP_ATTEMPTS_EXCEEDED ||
        parsed.code === OtpErrorCode.OTP_EXPIRED
      ) {
        setLocked(true)
      }
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    setServerError(null)
    try {
      const res = await resendMutation.mutateAsync({ data: { identifier } })
      onResent(unwrap<OtpChallenge>(res))
      setLocked(false)
      setFormKey((k) => k + 1)
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <VerifyOtpForm
      key={formKey}
      copy={copy}
      onSubmit={handleSubmit}
      onResend={() => void handleResend()}
      onChangeIdentifier={onChangeIdentifier}
      isPending={verifyMutation.isPending}
      isResending={resendMutation.isPending}
      locked={locked}
      secondsLeft={secondsLeft}
      canResend={canResend}
      limitReached={limitReached}
      errorMessage={serverError}
    />
  )
}
