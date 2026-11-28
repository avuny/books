import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import type { PlatformListRoles200DataItem as PlatformRoleDto } from "@/api/model"

import { PermissionMatrix, type PermissionMatrixLabels } from "./permission-matrix"

/** Localized strings for this dialog. Built and injected by the container. */
export type RoleFormDialogCopy = {
  title: string
  description: string
  keyLabel: string
  keyPlaceholder: string
  keyHelp: string
  nameLabel: string
  namePlaceholder: string
  descriptionLabel: string
  descriptionPlaceholder: string
  permissionsLabel: string
  permissionsHelp: string
  submitLabel: string
  submittingLabel: string
  cancelLabel: string
}

export type RoleFormValues = {
  key: string
  name: string
  description: string
  permissions: string[]
}

type RoleFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  copy: RoleFormDialogCopy
  permissionLabels: PermissionMatrixLabels
  /** Editing this role; undefined for create. The key is frozen when editing. */
  role?: PlatformRoleDto
  /** Cloning this role: prefilled description, empty key. */
  cloneFrom?: PlatformRoleDto
  /** Hide the permission matrix (clone: the server copies permissions). */
  hidePermissions?: boolean
  onSubmit: (values: RoleFormValues) => Promise<boolean>
  /** Already localized. Shown when submission fails. */
  errorMessage?: string | null
  isPending: boolean
}

// Create / edit / clone share this dialog; the container picks the copy and
// the mutation. Pure UI + local field state only.
export function RoleFormDialog({
  open,
  onOpenChange,
  ...props
}: RoleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content mounts on open, so field state initializes from the current
          role (or clone source) without sync effects. */}
      {open && (
        <RoleFormDialogContent {...props} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  )
}

function RoleFormDialogContent({
  copy,
  permissionLabels,
  role,
  cloneFrom,
  hidePermissions,
  onSubmit,
  errorMessage,
  isPending,
  onOpenChange,
}: Omit<RoleFormDialogProps, "open"> & {
  onOpenChange: (open: boolean) => void
}) {
  const [key, setKey] = useState("")
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(
    role?.description ?? cloneFrom?.description ?? ""
  )
  const [permissions, setPermissions] = useState<string[]>(
    role?.permissions ?? cloneFrom?.permissions ?? []
  )

  const editing = role !== undefined
  const canSubmit =
    (editing || key.trim().length > 0) && name.trim().length > 0 && !isPending

  const handleSubmit = async () => {
    const done = await onSubmit({
      key: key.trim(),
      name: name.trim(),
      description: description.trim(),
      permissions,
    })
    if (done) onOpenChange(false)
  }

  return (
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="space-y-1">
              <Label htmlFor="role-key">{copy.keyLabel}</Label>
              <Input
                id="role-key"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={copy.keyPlaceholder}
                autoComplete="off"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{copy.keyHelp}</p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="role-name">{copy.nameLabel}</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={copy.namePlaceholder}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="role-description">{copy.descriptionLabel}</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={copy.descriptionPlaceholder}
              rows={2}
              disabled={isPending}
            />
          </div>

          {!hidePermissions && (
          <PermissionMatrix
            selected={permissions}
            onChange={setPermissions}
            disabled={isPending}
            labels={permissionLabels}
            legend={copy.permissionsLabel}
            help={copy.permissionsHelp}
          />
          )}

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {copy.cancelLabel}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? copy.submittingLabel : copy.submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
  )
}
