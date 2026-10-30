import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  AcceptInvitationForm,
  useAcceptInvitationFormCopy,
} from "../forms"
import {
  useAcceptInvitationByTokenMutation,
  useInvitationPreview,
} from "../invitation-api"
import {
  getInvitationContact,
  useFormatDate,
  useInvitationLabels,
} from "../lib"
import type { AcceptMyInvitationInput } from "../types"
import {
  AcceptInvitationView,
  type AcceptInvitationDetail,
} from "./accept-invitation-view"

type AcceptInvitationProps = {
  /** The link token (from the page URL). */
  token: string | undefined
  /** The route knows the session; this module has no auth knowledge. */
  isAuthenticated: boolean
  /** Signed-out visitors are sent to sign in or sign up. */
  onSignIn: () => void
  /** The route decides where to go after joining. */
  onSuccess?: () => void
}

// Composition only: loads the preview, wires strings + API behavior into the pure view.
export function AcceptInvitation({
  token,
  isAuthenticated,
  onSignIn,
  onSuccess,
}: AcceptInvitationProps) {
  const { t } = useTranslation("organization-invitation")
  const [serverError, setServerError] = useState<string | null>(null)

  const { preview, isLoading, error } = useInvitationPreview(token)
  const acceptMutation = useAcceptInvitationByTokenMutation()
  const copy = useAcceptInvitationFormCopy()
  const { getTypeLabel, getChannelLabel } = useInvitationLabels()
  const formatDate = useFormatDate()

  // Called only when Zod validation passes (the resolver guards the fields).
  const handleSubmit = async (values: AcceptMyInvitationInput) => {
    if (!token) return
    setServerError(null)
    try {
      await acceptMutation.mutateAsync({ data: { token, ...values } })
      onSuccess?.()
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  const status = isLoading ? "loading" : preview ? "ready" : "error"

  const details: AcceptInvitationDetail[] = preview
    ? [
        {
          label: t("join.organization"),
          value: `${preview.orgName} (${preview.orgCode})`,
        },
        { label: t("join.type"), value: getTypeLabel(preview.type) },
        {
          label: t("join.sentTo", { channel: getChannelLabel(preview.channel) }),
          value: getInvitationContact(preview) ?? "—",
        },
        ...(preview.username
          ? [{ label: t("join.username"), value: preview.username }]
          : []),
        { label: t("join.expires"), value: formatDate(preview.expiresAt) },
      ]
    : []

  return (
    <AcceptInvitationView
      status={status}
      errorMessage={
        !token
          ? t("join.missingToken")
          : error
            ? parseApiError(error).message
            : null
      }
      title={preview ? t("join.title", { name: preview.orgName }) : ""}
      description={t("join.description")}
      details={details}
      action={
        isAuthenticated ? (
          <AcceptInvitationForm
            copy={copy}
            // The inviter may have chosen a username already; otherwise ask for one.
            showUsername={preview?.username === null}
            onSubmit={handleSubmit}
            isPending={acceptMutation.isPending}
            errorMessage={serverError}
          />
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {t("join.signInPrompt")}
            </p>
            <Button type="button" className="w-full" onClick={onSignIn}>
              {t("join.signIn")}
            </Button>
          </div>
        )
      }
    />
  )
}
