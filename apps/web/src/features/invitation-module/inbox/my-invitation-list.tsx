import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  useDeclineMyInvitationMutation,
  useMyInvitations,
} from "../invitation-api"
import { useFormatDate, useInvitationLabels } from "../lib"
import type { MyInvitationDto } from "../types"
import { AcceptMyInvitationDialog } from "./accept-my-invitation-dialog"
import {
  MyInvitationListView,
  type MyInvitationItem,
} from "./my-invitation-list-view"

type MyInvitationListProps = {
  /** The route decides where to go after joining (usually the organization). */
  onAccepted?: (invitation: MyInvitationDto) => void
}

// Composition only: strings + API behavior wired into the pure view.
export function MyInvitationList({ onAccepted }: MyInvitationListProps) {
  const { t } = useTranslation("organization-invitation")

  const { invitations, isLoading, error } = useMyInvitations()
  const { getTypeLabel, getChannelLabel } = useInvitationLabels()
  const formatDate = useFormatDate()
  const declineMutation = useDeclineMyInvitationMutation()

  const [invitationToAccept, setInvitationToAccept] =
    useState<MyInvitationDto | null>(null)
  const [invitationToDecline, setInvitationToDecline] =
    useState<MyInvitationDto | null>(null)
  const [declineError, setDeclineError] = useState<string | null>(null)

  const items = useMemo<MyInvitationItem[]>(
    () =>
      invitations.map((invitation) => ({
        id: invitation.id,
        title: invitation.org.name,
        badge: getTypeLabel(invitation.type),
        details: [
          invitation.org.code,
          t("inbox.via", { channel: getChannelLabel(invitation.channel) }),
          t("inbox.expires", { date: formatDate(invitation.expiresAt) }),
          ...(invitation.username
            ? [t("inbox.username", { username: invitation.username })]
            : []),
        ],
      })),
    [invitations, t, getTypeLabel, getChannelLabel, formatDate]
  )

  /* --------------------------------- decline ------------------------------- */
  const closeDeclineDialog = () => {
    setInvitationToDecline(null)
    setDeclineError(null)
  }

  const handleDecline = async () => {
    if (!invitationToDecline) return
    setDeclineError(null)
    try {
      await declineMutation.mutateAsync({ invitationId: invitationToDecline.id })
      closeDeclineDialog()
    } catch (e) {
      setDeclineError(parseApiError(e).message || null)
    }
  }

  const findInvitation = (id: string) =>
    invitations.find((invitation) => invitation.id === id) ?? null

  return (
    <>
      <MyInvitationListView
        items={items}
        isLoading={isLoading}
        errorMessage={error ? parseApiError(error).message : null}
        copy={{
          title: t("inbox.title"),
          description: t("inbox.description"),
          emptyTitle: t("inbox.empty.title"),
          emptyDescription: t("inbox.empty.description"),
          acceptLabel: t("actions.accept"),
          declineLabel: t("actions.decline"),
        }}
        onAccept={(id) => setInvitationToAccept(findInvitation(id))}
        onDecline={(id) => setInvitationToDecline(findInvitation(id))}
      />

      <AcceptMyInvitationDialog
        invitation={invitationToAccept}
        onOpenChange={(open) => {
          if (!open) setInvitationToAccept(null)
        }}
        onSuccess={(invitation) => {
          setInvitationToAccept(null)
          onAccepted?.(invitation)
        }}
      />

      <ConfirmDialog
        open={invitationToDecline !== null}
        onOpenChange={(open) => {
          if (!open) closeDeclineDialog()
        }}
        title={t("decline.title")}
        description={
          declineError ??
          t("decline.description", { name: invitationToDecline?.org.name })
        }
        confirmLabel={t("actions.decline")}
        cancelLabel={t("actions.cancel")}
        isLoading={declineMutation.isPending}
        onConfirm={handleDecline}
      />
    </>
  )
}
