import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  getPlatformListRolesQueryKey,
  usePlatformCloneRole,
  usePlatformCreateRole,
  usePlatformDeleteRole,
  usePlatformListRoles,
  usePlatformUpdateRole,
} from "@/api"
import type { PlatformListRoles200DataItem as PlatformRoleDto } from "@/api/model"

import { useCurrentAdmin } from "../platform-auth-module"

import {
  RoleFormDialog,
  type RoleFormDialogCopy,
  type RoleFormValues,
} from "./role-form-dialog"

const DATE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

// Composition only: strings + mutations wired into the pure dialog primitives.
export function RolesList() {
  const { t } = useTranslation("platform-admin")
  const queryClient = useQueryClient()
  const { hasPermission } = useCurrentAdmin()

  const rolesQuery = usePlatformListRoles()
  const createMutation = usePlatformCreateRole()
  const updateMutation = usePlatformUpdateRole()
  const cloneMutation = usePlatformCloneRole()
  const deleteMutation = usePlatformDeleteRole()

  const [createOpen, setCreateOpen] = useState(false)
  const [editRole, setEditRole] = useState<PlatformRoleDto | null>(null)
  const [cloneRole, setCloneRole] = useState<PlatformRoleDto | null>(null)
  const [deleteRole, setDeleteRole] = useState<PlatformRoleDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const roles = rolesQuery.data?.data ?? []
  const canCreate = hasPermission("create:platform-role")
  const canUpdate = hasPermission("update:platform-role")
  const canClone = hasPermission("clone:platform-role")
  const canDelete = hasPermission("delete:platform-role")

  // Registry resource/action labels live in the contracts locale files.
  const resources = t("roles.permissions.resources", { returnObjects: true })
  const actions = t("roles.permissions.actions", { returnObjects: true })
  const permissionLabels = {
    resources: typeof resources === "object" ? (resources as Record<string, string>) : {},
    actions: typeof actions === "object" ? (actions as Record<string, string>) : {},
  }

  const copy = (ns: "create" | "edit" | "clone"): RoleFormDialogCopy => ({
    title: t(`roles.${ns}.title`),
    description: t(`roles.${ns}.description`),
    keyLabel: t("roles.form.key.label"),
    keyPlaceholder: t("roles.form.key.placeholder"),
    keyHelp: t("roles.form.keyHelp"),
    nameLabel: t("roles.form.name.label"),
    namePlaceholder: t("roles.form.name.placeholder"),
    descriptionLabel: t("roles.form.description.label"),
    descriptionPlaceholder: t("roles.form.description.placeholder"),
    permissionsLabel: t("roles.form.permissionsLabel"),
    permissionsHelp: t("roles.form.permissionsHelp"),
    submitLabel: t(`roles.${ns}.submitLabel`),
    submittingLabel: t(`roles.${ns}.submittingLabel`),
    cancelLabel: t("roles.delete.cancelLabel"),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getPlatformListRolesQueryKey() })
  }

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setActionError(null)
    try {
      await action()
      await invalidate()
      return true
    } catch (e) {
      setActionError(parseApiError(e).message || t("auth.signIn.genericError"))
      return false
    }
  }

  if (rolesQuery.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t("shell.loading")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t("roles.title")}</h1>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("roles.createLabel")}
          </Button>
        )}
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("roles.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("roles.columns.key")}</TableHead>
              <TableHead>{t("roles.columns.name")}</TableHead>
              <TableHead>{t("roles.columns.type")}</TableHead>
              <TableHead>{t("roles.columns.permissions")}</TableHead>
              <TableHead>{t("roles.columns.createdAt")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-mono text-xs">{role.key}</TableCell>
                <TableCell>{role.name}</TableCell>
                <TableCell>
                  <Badge variant={role.isBuiltin ? "secondary" : "outline"}>
                    {role.isBuiltin
                      ? t("roles.builtinBadge")
                      : t("roles.customBadge")}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {role.permissions.length}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {DATE_FORMAT.format(new Date(role.createdAt))}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {canUpdate && !role.isBuiltin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActionError(null)
                          setEditRole(role)
                        }}
                      >
                        {t("roles.editLabel")}
                      </Button>
                    )}
                    {canClone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActionError(null)
                          setCloneRole(role)
                        }}
                      >
                        {t("roles.clone.label")}
                      </Button>
                    )}
                    {canDelete && !role.isBuiltin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setActionError(null)
                          setDeleteRole(role)
                        }}
                      >
                        {t("roles.delete.label")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        copy={copy("create")}
        permissionLabels={permissionLabels}
        errorMessage={actionError}
        isPending={createMutation.isPending}
        onSubmit={(values: RoleFormValues) =>
          run(() =>
            createMutation.mutateAsync({
              data: {
                key: values.key,
                name: values.name,
                description: values.description || undefined,
                permissions: values.permissions,
              },
            })
          )
        }
      />

      <RoleFormDialog
        open={editRole !== null}
        onOpenChange={(open) => {
          if (!open) setEditRole(null)
        }}
        copy={copy("edit")}
        permissionLabels={permissionLabels}
        role={editRole ?? undefined}
        errorMessage={actionError}
        isPending={updateMutation.isPending}
        onSubmit={(values: RoleFormValues) =>
          editRole
            ? run(() =>
                updateMutation.mutateAsync({
                  roleId: editRole.id,
                  data: {
                    name: values.name,
                    description: values.description,
                    permissions: values.permissions,
                  },
                })
              )
            : Promise.resolve(false)
        }
      />

      <RoleFormDialog
        open={cloneRole !== null}
        onOpenChange={(open) => {
          if (!open) setCloneRole(null)
        }}
        copy={copy("clone")}
        permissionLabels={permissionLabels}
        cloneFrom={cloneRole ?? undefined}
        hidePermissions
        errorMessage={actionError}
        isPending={cloneMutation.isPending}
        onSubmit={(values: RoleFormValues) =>
          cloneRole
            ? run(() =>
                cloneMutation.mutateAsync({
                  roleId: cloneRole.id,
                  data: {
                    key: values.key,
                    name: values.name,
                    description: values.description || undefined,
                  },
                })
              )
            : Promise.resolve(false)
        }
      />

      <AlertDialog
        open={deleteRole !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRole(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("roles.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("roles.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("roles.delete.cancelLabel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={async (event) => {
                event.preventDefault()
                if (!deleteRole) return
                const done = await run(() =>
                  deleteMutation.mutateAsync({ roleId: deleteRole.id })
                )
                if (done) setDeleteRole(null)
              }}
            >
              {deleteMutation.isPending
                ? t("roles.delete.confirmingLabel")
                : t("roles.delete.confirmLabel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
