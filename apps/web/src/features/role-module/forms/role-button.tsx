import { useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { RoleDialog } from "./role-dialog"

type RoleButtonProps = {
  orgId: string
  /** Given: opens the update dialog. Omitted: opens the create dialog. */
  roleId?: string
  /** Update only: render the trigger as an icon button or as a text button. */
  display?: "icon" | "text"
  className?: string
}

export function RoleButton({
  orgId,
  roleId,
  display = "text",
  className,
}: RoleButtonProps) {
  const { t } = useTranslation("role")
  const [open, setOpen] = useState(false)

  const isUpdate = roleId !== undefined
  const label = isUpdate ? t("actions.edit") : t("actions.create")
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

      <RoleDialog
        orgId={orgId}
        roleId={roleId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
