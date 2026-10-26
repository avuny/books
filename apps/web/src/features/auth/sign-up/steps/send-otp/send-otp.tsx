import { useState } from "react"
import { useTranslation } from "react-i18next"

import { useSignUpSendOtp } from "@/api"
import { parseApiError, unwrap } from "@/features/auth/lib/api-error"
import type { OtpChallenge } from "@/features/auth/types"
import { SendOtpForm, type SendOtpFormValues } from "./send-otp-form"

type SendOtpProps = {
  /** Pre-fills the field (e.g. after "change email" on the next step). */
  defaultIdentifier: string
  /** One-off, already localized message from the flow (e.g. proof expired). */
  notice?: string | null
  onSent: (identifier: string, challenge: OtpChallenge) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function SendOtp({ defaultIdentifier, notice, onSent }: SendOtpProps) {
  const { t } = useTranslation("user")
  const sendOtpMutation = useSignUpSendOtp()
  const [serverError, setServerError] = useState<string | null>(null)

  const copy = {
    title: t("auth.signUp.sendOtp.title"),
    description: t("auth.signUp.sendOtp.description"),
    identifier: {
      label: t("auth.signUp.sendOtp.identifier.label"),
      placeholder: t("auth.signUp.sendOtp.identifier.placeholder"),
    },
    submitLabel: t("auth.signUp.sendOtp.submitLabel"),
    submittingLabel: t("auth.signUp.sendOtp.submittingLabel"),
  }

  // Called only when Zod validation passes.
  const handleSubmit = async (values: SendOtpFormValues) => {
    setServerError(null)
    try {
      const res = await sendOtpMutation.mutateAsync({ data: values })
      onSent(values.identifier, unwrap<OtpChallenge>(res))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <SendOtpForm
      copy={copy}
      defaultIdentifier={defaultIdentifier}
      onSubmit={handleSubmit}
      isPending={sendOtpMutation.isPending}
      errorMessage={serverError ?? notice}
    />
  )
}
