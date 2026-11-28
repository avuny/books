import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
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
import { Spinner } from "@workspace/ui/components/spinner"

import {
  getPlatformGetAdminQueryKey,
  getPlatformListAdminsQueryKey,
  usePlatformDisableAdmin,
  usePlatformGetAdmin,
  usePlatformListRoles,
  usePlatformSetAdminRoles,
  usePlatformUpdateAdmin,
} from "@/api"
import type {
  PlatformGetAdmin200Data as AdminDto,
  PlatformListRoles200DataItem as PlatformRoleDto,
} from "@/api/model"

import { useCurrentAdmin } from "../platform-auth-module"

import { RoleCheckboxGroup } from "./role-checkbox-group"

type AdminDetailProps = {
  adminId: string
  /** The route decides how to go back to the list. */
  onBack: () => void
  /** The route decides where a disabled admin leaves the page. */
  onDisabled: () => void
}

const DATE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

// Composition only: strings + API behavior wired into pure UI primitives.
export function AdminDetail({ adminId, onBack, onDisabled }: AdminDetailProps) {
  const { t } = useTranslation("platform-admin")
  const queryClient = useQueryClient()
  const { admin: currentAdmin, hasPermission } = useCurrentAdmin()

  const adminQuery = usePlatformGetAdmin(adminId)
  const rolesQuery = usePlatformListRoles()
  const updateMutation = usePlatformUpdateAdmin()
  const rolesMutation = usePlatformSetAdminRoles()
  const disableMutation = usePlatformDisableAdmin()

  const [editOpen, setEditOpen] = useState(false)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const admin = adminQuery.data?.data
  const roles = useMemo(() => rolesQuery.data?.data ?? [], [rolesQuery.data])
  const isSelf = currentAdmin?.id === adminId

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: getPlatformGetAdminQueryKey(adminId),
    })
    await queryClient.invalidateQueries({
      queryKey: getPlatformListAdminsQueryKey(),
    })
  }

  const runAction = async (action: () => Promise<unknown>) => {
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

  if (adminQuery.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t("shell.loading")}
      </div>
    )
  }
  if (!admin) {
    return (
      <p className="text-sm text-muted-foreground">{t("admins.detail.notFound")}</p>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" />
        {t("admins.detail.backLabel")}
      </Button>

      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">{admin.name}</h1>
          <Badge
            variant={
              admin.status === "active"
                ? "default"
                : admin.status === "disabled"
                  ? "destructive"
                  : "secondary"
            }
          >
            {t(`admins.status.${admin.status}`)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{admin.email}</p>
      </div>

      <section className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("admins.detail.profileTitle")}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("admins.columns.roles")}</dt>
          <dd className="flex flex-wrap gap-1">
            {admin.roles.map((role) => (
              <Badge key={role} variant="outline">
                {role}
              </Badge>
            ))}
          </dd>
          <dt className="text-muted-foreground">{t("admins.columns.createdAt")}</dt>
          <dd>{DATE_FORMAT.format(new Date(admin.createdAt))}</dd>
          <dt className="text-muted-foreground">TOTP</dt>
          <dd>
            {admin.totpEnabledAt
              ? t("admins.detail.totpEnabled")
              : t("admins.detail.totpPending")}
          </dd>
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        {hasPermission("update:platform-admin") && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              {t("admins.editLabel")}
            </Button>
            {!isSelf && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRolesOpen(true)}
              >
                {t("admins.rolesLabel")}
              </Button>
            )}
          </>
        )}
        {hasPermission("disable:platform-admin") &&
          !isSelf &&
          admin.status !== "disabled" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDisableOpen(true)}
            >
              {t("admins.disable.label")}
            </Button>
          )}
      </div>

      {/* Dialog content mounts on open, so field state initializes from the
          current admin without sync effects. */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editOpen && (
          <EditNameDialog
            admin={admin}
            isPending={updateMutation.isPending}
            errorMessage={actionError}
            onCancel={() => setEditOpen(false)}
            onSubmit={async (name) => {
              const done = await runAction(() =>
                updateMutation.mutateAsync({ adminId, data: { name } })
              )
              if (done) setEditOpen(false)
            }}
          />
        )}
      </Dialog>

      {/* Replace roles (PA-R2..PA-R4 enforced server-side) */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        {rolesOpen && (
          <EditRolesDialog
            admin={admin}
            roles={roles}
            isPending={rolesMutation.isPending}
            errorMessage={actionError}
            onCancel={() => setRolesOpen(false)}
            onSubmit={async (roleIds) => {
              const done = await runAction(() =>
                rolesMutation.mutateAsync({ adminId, data: { roleIds } })
              )
              if (done) setRolesOpen(false)
            }}
          />
        )}
      </Dialog>

      {/* Disable */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admins.disable.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admins.disable.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disableMutation.isPending}>
              {t("admins.disable.cancelLabel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={disableMutation.isPending}
              onClick={async (event) => {
                event.preventDefault()
                const done = await runAction(() =>
                  disableMutation.mutateAsync({ adminId })
                )
                if (done) {
                  setDisableOpen(false)
                  onDisabled()
                }
              }}
            >
              {disableMutation.isPending
                ? t("admins.disable.confirmingLabel")
                : t("admins.disable.confirmLabel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type EditNameDialogProps = {
  admin: AdminDto
  isPending: boolean
  errorMessage: string | null
  onCancel: () => void
  onSubmit: (name: string) => Promise<void>
}

function EditNameDialog({
  admin,
  isPending,
  errorMessage,
  onCancel,
  onSubmit,
}: EditNameDialogProps) {
  const { t } = useTranslation("platform-admin")
  const [name, setName] = useState(admin.name)

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("admins.edit.title")}</DialogTitle>
        <DialogDescription>{t("admins.edit.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="admin-name">{t("admins.edit.name.label")}</Label>
        <Input
          id="admin-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("admins.edit.name.placeholder")}
          disabled={isPending}
        />
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          {t("admins.disable.cancelLabel")}
        </Button>
        <Button
          disabled={name.trim().length === 0 || isPending}
          onClick={() => onSubmit(name.trim())}
        >
          {isPending ? t("admins.edit.submittingLabel") : t("admins.edit.submitLabel")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

type EditRolesDialogProps = {
  admin: AdminDto
  roles: PlatformRoleDto[]
  isPending: boolean
  errorMessage: string | null
  onCancel: () => void
  onSubmit: (roleIds: string[]) => Promise<void>
}

function EditRolesDialog({
  admin,
  roles,
  isPending,
  errorMessage,
  onCancel,
  onSubmit,
}: EditRolesDialogProps) {
  const { t } = useTranslation("platform-admin")
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(() => {
    const byKey = new Map(roles.map((role) => [role.key, role.id]))
    return admin.roles
      .map((key) => byKey.get(key))
      .filter((id): id is string => !!id)
  })

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("admins.roles.title")}</DialogTitle>
        <DialogDescription>{t("admins.roles.description")}</DialogDescription>
      </DialogHeader>
      <RoleCheckboxGroup
        roles={roles}
        selectedIds={selectedRoleIds}
        onChange={setSelectedRoleIds}
        disabled={isPending}
        label={t("admins.invite.rolesLabel")}
        help={t("admins.roles.description")}
        emptyLabel={t("admins.roles.emptyLabel")}
      />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          {t("admins.disable.cancelLabel")}
        </Button>
        <Button disabled={isPending} onClick={() => onSubmit(selectedRoleIds)}>
          {isPending ? t("admins.roles.submittingLabel") : t("admins.roles.submitLabel")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
