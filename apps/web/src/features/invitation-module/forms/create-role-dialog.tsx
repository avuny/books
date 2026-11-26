/**
 * apps/web/src/features/role/create-role-dialog.tsx (new, skeleton)
 *
 * Same shape as InvitationDialog, around the role feature's own create form.
 * ASSUMPTIONS to check against your role feature:
 *   - a composition component `CreateRole` exists, taking `orgId` and `onSuccess(role)`
 *   - the "role" i18n namespace has `create.title` and `create.description`
 * If your create component has a different name or props, change only the marked lines.
 */
import { useTranslation } from "react-i18next"
import type { RoleDto } from "@avuny/contracts"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { CreateRole } from "@/features/role-module"

type CreateRoleDialogProps = {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the user had typed in the combobox search box. Prefill the name with it if the form supports it. */
  defaultName?: string
  /** Receives the created role; the combobox uses it to select the new role. */
  onSuccess: (role: RoleDto) => void
}

/** Controlled modal around the create-role form. */
export function CreateRoleDialog({
  orgId,
  open,
  onOpenChange,
  defaultName,
  onSuccess,
}: CreateRoleDialogProps) {
  const { t } = useTranslation("role")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the invitation dialog: a role form usually carries a permissions picker. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        {/* <- adjust props to your form; `defaultName` is optional */}
        <CreateRole
          orgId={orgId}
          defaultName={defaultName}
          onSuccess={(role) => {
            onSuccess(role) // selects the role in the invitation form's combobox
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
