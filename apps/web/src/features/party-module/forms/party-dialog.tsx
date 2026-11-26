import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { CreateParty } from "./create-party.js"
import { UpdateParty } from "./update-party.js"
import type { PartyDto, PartyRole } from "../types.js"

export interface PartyDialogProps {
  orgId: string
  role: PartyRole
  partyId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (party: PartyDto) => void
}

export function PartyDialog({
  orgId,
  role,
  partyId,
  open,
  onOpenChange,
  onSuccess,
}: PartyDialogProps) {
  const { t } = useTranslation("party")
  const mode = partyId ? "update" : "create"
  const close = () => onOpenChange(false)

  const handleSuccess = (party: PartyDto) => {
    close()
    onSuccess?.(party)
  }

  const title =
    mode === "create"
      ? t(`create.${role}.title`, {
          defaultValue: `New ${role === "CUSTOMER" ? "Customer" : "Vendor"}`,
        })
      : t("update.title", { defaultValue: "Edit Party" })

  const description =
    mode === "create"
      ? t(`create.${role}.description`, {
          defaultValue: `Add a new ${role.toLowerCase()} to your organization.`,
        })
      : t("update.description", { defaultValue: "Update information for this party." })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {partyId ? (
          <UpdateParty
            key={partyId}
            orgId={orgId}
            partyId={partyId}
            role={role}
            onSuccess={handleSuccess}
            onCancel={close}
          />
        ) : (
          <CreateParty
            orgId={orgId}
            role={role}
            onSuccess={handleSuccess}
            onCancel={close}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
