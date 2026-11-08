import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { AcceptInvitationForm, useAcceptInvitationFormCopy } from "../forms"
import { useAcceptMyInvitationMutation } from "../invitation-api"
import type { AcceptMyInvitationInput, MyInvitationDto } from "../types"

type AcceptMyInvitationDialogProps = {
  /** The invitation being accepted; null keeps the dialog closed. */
  invitation: MyInvitationDto | null
  onOpenChange: (open: boolean) => void
  onSuccess?: (invitation: MyInvitationDto) => void
}

// Composition only: strings + API behavior wired into the pure accept form.
export function AcceptMyInvitationDialog({
  invitation,
  onOpenChange,
  onSuccess,
}: AcceptMyInvitationDialogProps) {
  const { t } = useTranslation(["organization-invitation", "role"])
  const [serverError, setServerError] = useState<string | null>(null)

  const acceptMutation = useAcceptMyInvitationMutation()
  const copy = useAcceptInvitationFormCopy()

  const roleLabel = invitation?.roleName
    ? t(`role:labels.systemRoles.${invitation.roleName}`, {
        defaultValue: invitation.roleName,
      })
    : null

  // Called only when Zod validation passes (the resolver guards the fields).
  const handleSubmit = async (values: AcceptMyInvitationInput) => {
    if (!invitation) return
    setServerError(null)
    try {
      await acceptMutation.mutateAsync({
        invitationId: invitation.id,
        data: values,
      })
      onSuccess?.(invitation)
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <Dialog
      open={invitation !== null}
      onOpenChange={(open) => {
        if (!open) setServerError(null)
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("accept.title", { name: invitation?.org.name })}
          </DialogTitle>
          <DialogDescription>
            {roleLabel
              ? t("accept.descriptionWithRole", { role: roleLabel })
              : t("accept.description")}
          </DialogDescription>
        </DialogHeader>

        {roleLabel ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">
              {t("accept.role")}:
            </span>
            <span className="font-medium text-foreground">{roleLabel}</span>
          </div>
        ) : null}

        {invitation ? (
          <AcceptInvitationForm
            key={invitation.id}
            copy={copy}
            showUsername={false}
            onSubmit={handleSubmit}
            isPending={acceptMutation.isPending}
            errorMessage={serverError}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
