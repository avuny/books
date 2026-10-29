import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { CreateRole } from "./create-role"
import { UpdateRole } from "./update-role"

type RoleDialogProps = {
  orgId: string
  /** With a roleId the dialog edits that role; without one it creates a role. */
  roleId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Controlled modal around the create / update forms. The list uses it directly
 * for the row menu's "Edit" item, because a menu item cannot own a dialog.
 */
export function RoleDialog({
  orgId,
  roleId,
  open,
  onOpenChange,
}: RoleDialogProps) {
  const { t } = useTranslation("role")
  const mode = roleId ? "update" : "create"
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        {roleId ? (
          <UpdateRole
            key={roleId}
            orgId={orgId}
            roleId={roleId}
            onSuccess={close}
          />
        ) : (
          <CreateRole orgId={orgId} onSuccess={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
