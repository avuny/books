import { useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

import { PartyDialog } from "./party-dialog.js"
import type { PartyDto, PartyRole } from "../types.js"

export interface PartyButtonProps {
  orgId: string
  role: PartyRole
  partyId?: string
  display?: "icon" | "text"
  className?: string
  onSuccess?: (party: PartyDto) => void
}

export function PartyButton({
  orgId,
  role,
  partyId,
  display = "text",
  className,
  onSuccess,
}: PartyButtonProps) {
  const { t } = useTranslation("party")
  const [open, setOpen] = useState(false)
  const isUpdate = Boolean(partyId)

  const label = isUpdate
    ? t("actions.edit", { defaultValue: "Edit" })
    : t(`actions.create.${role}`, {
        defaultValue: role === "CUSTOMER" ? "New customer" : "New vendor",
      })

  const Icon = isUpdate ? Pencil : Plus

  return (
    <>
      {isUpdate && display === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          aria-label={label}
          onClick={() => setOpen(true)}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          variant={isUpdate ? "outline" : "default"}
          className={className}
          onClick={() => setOpen(true)}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Button>
      )}

      <PartyDialog
        orgId={orgId}
        role={role}
        partyId={partyId}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  )
}
