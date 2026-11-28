import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { usePlatformAcceptInvite, usePlatformEnrollTotp } from "@/api"

import {
  AcceptInviteForm,
  type AcceptInviteFormValues,
} from "./accept-invite-form"
import { EnrollTotpForm, type EnrollTotpFormValues } from "./enroll-totp-form"

type AcceptInviteProps = {
  /** The invite token from the link's query string; empty when missing. */
  token: string
  /** The route decides where a finished enrollment lands. */
  onSuccess: () => void
}

type Enrollment = {
  enrollmentTicket: string
  totpSecret: string
}

// Invite acceptance is the only way an admin account is created (PAC1):
// password first, then mandatory TOTP enrollment, which also signs in.
export function AcceptInvite({ token, onSuccess }: AcceptInviteProps) {
  const { t } = useTranslation("platform-admin")
  const queryClient = useQueryClient()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const acceptMutation = usePlatformAcceptInvite()
  const enrollMutation = usePlatformEnrollTotp()

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
          {t("auth.acceptInvite.missingToken")}
        </p>
      </div>
    )
  }

  const handleAccept = async (values: AcceptInviteFormValues) => {
    setServerError(null)
    try {
      const res = await acceptMutation.mutateAsync({
        data: { token, name: values.name, password: values.password },
      })
      setEnrollment({
        enrollmentTicket: res.data.enrollmentTicket,
        totpSecret: res.data.totpSecret,
      })
    } catch (e) {
      setServerError(
        parseApiError(e).message || t("auth.signIn.genericError")
      )
    }
  }

  const handleEnroll = async (values: EnrollTotpFormValues) => {
    if (!enrollment) return
    setServerError(null)
    try {
      await enrollMutation.mutateAsync({
        data: {
          enrollmentTicket: enrollment.enrollmentTicket,
          code: values.code,
        },
      })
      await queryClient.invalidateQueries()
      onSuccess()
    } catch (e) {
      setServerError(parseApiError(e).message || t("auth.signIn.genericError"))
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      {enrollment === null ? (
        <AcceptInviteForm
          copy={{
            title: t("auth.acceptInvite.title"),
            description: t("auth.acceptInvite.description"),
            name: {
              label: t("auth.acceptInvite.name.label"),
              placeholder: t("auth.acceptInvite.name.placeholder"),
            },
            password: {
              label: t("auth.acceptInvite.password.label"),
              placeholder: t("auth.acceptInvite.password.placeholder"),
            },
            passwordHelp: t("auth.acceptInvite.passwordHelp"),
            submitLabel: t("auth.acceptInvite.submitLabel"),
            submittingLabel: t("auth.acceptInvite.submittingLabel"),
          }}
          onSubmit={handleAccept}
          isPending={acceptMutation.isPending}
          errorMessage={serverError}
        />
      ) : (
        <EnrollTotpForm
          copy={{
            title: t("auth.enrollTotp.title"),
            description: t("auth.enrollTotp.description"),
            secretLabel: t("auth.enrollTotp.secretLabel"),
            secretHelp: t("auth.enrollTotp.secretHelp"),
            code: {
              label: t("auth.enrollTotp.code.label"),
              placeholder: t("auth.enrollTotp.code.placeholder"),
            },
            submitLabel: t("auth.enrollTotp.submitLabel"),
            submittingLabel: t("auth.enrollTotp.submittingLabel"),
          }}
          totpSecret={enrollment.totpSecret}
          onSubmit={handleEnroll}
          isPending={enrollMutation.isPending}
          errorMessage={serverError}
        />
      )}
    </div>
  )
}
