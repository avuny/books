import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { CreateInvitation } from "./create-invitation"

type InvitationDialogProps = {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Controlled modal around the create-invitation form. */
export function InvitationDialog({
  orgId,
  open,
  onOpenChange,
}: InvitationDialogProps) {
  const { t } = useTranslation("organization-invitation")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <CreateInvitation orgId={orgId} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
