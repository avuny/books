import { useState } from "react"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { InvitationDialog } from "./invitation-dialog"

type InvitationButtonProps = {
  orgId: string
  className?: string
}

/** "Invite" button that opens the create-invitation dialog. */
export function InvitationButton({ orgId, className }: InvitationButtonProps) {
  const { t } = useTranslation("organization-invitation")
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" aria-hidden />
        {t("actions.create")}
      </Button>

      <InvitationDialog orgId={orgId} open={open} onOpenChange={setOpen} />
    </>
  )
}
