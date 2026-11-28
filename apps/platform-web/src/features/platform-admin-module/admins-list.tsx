import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  getPlatformListAdminsQueryKey,
  usePlatformInviteAdmin,
  usePlatformListAdmins,
  usePlatformListRoles,
} from "@/api"
import type {
  PlatformListAdmins200DataAdminsItem as AdminDto,
  PlatformListAdminsStatus,
} from "@/api/model"

import { useCurrentAdmin } from "../platform-auth-module"

import { InviteAdminDialog } from "./invite-admin-dialog"

type AdminsListProps = {
  /** The route decides how to open an admin's detail page. */
  onViewAdmin: (adminId: string) => void
}

const DATE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

// Composition only: strings + API behavior wired into pure UI primitives.
export function AdminsList({ onViewAdmin }: AdminsListProps) {
  const { t } = useTranslation("platform-admin")
  const queryClient = useQueryClient()
  const { hasPermission } = useCurrentAdmin()

  const [statusFilter, setStatusFilter] = useState<
    PlatformListAdminsStatus | undefined
  >(undefined)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [pages, setPages] = useState<AdminDto[][]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const adminsQuery = usePlatformListAdmins({
    limit: 50,
    status: statusFilter,
    cursor,
  })
  const rolesQuery = usePlatformListRoles()
  const inviteMutation = usePlatformInviteAdmin()

  // Keyset pagination: each "load more" appends the freshly fetched page.
  // React-endorsed derived-state pattern: compare and adjust during render.
  const fetched = adminsQuery.data?.data
  const [lastFetched, setLastFetched] = useState(fetched)
  if (fetched && fetched !== lastFetched) {
    setLastFetched(fetched)
    setPages((prev) =>
      prev[prev.length - 1] === fetched.admins ? prev : [...prev, fetched.admins]
    )
  }
  const admins = pages.flat()
  const nextCursor = fetched?.nextCursor ?? null

  const applyFilter = (status: PlatformListAdminsStatus | undefined) => {
    setStatusFilter(status)
    setCursor(undefined)
    setPages([])
    setLastFetched(undefined)
  }

  const handleInvite = async (input: { email: string; roleIds: string[] }) => {
    setInviteError(null)
    try {
      const res = await inviteMutation.mutateAsync({ data: input })
      await queryClient.invalidateQueries({
        queryKey: getPlatformListAdminsQueryKey(),
      })
      applyFilter(undefined)
      return res.data.inviteUrl
    } catch (e) {
      const message = parseApiError(e).message
      setInviteError(message || t("auth.signIn.genericError"))
      throw e
    }
  }

  const FILTERS = [
    { value: undefined, label: t("admins.filter.all") },
    { value: "active" as const, label: t("admins.filter.active") },
    { value: "invited" as const, label: t("admins.filter.invited") },
    { value: "disabled" as const, label: t("admins.filter.disabled") },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {t("admins.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admins.description")}
          </p>
        </div>
        {hasPermission("create:platform-admin") && (
          <Button onClick={() => setInviteOpen(true)}>
            {t("admins.inviteLabel")}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {FILTERS.map((filter) => (
          <Button
            key={filter.label}
            variant={statusFilter === filter.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => applyFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admins.columns.name")}</TableHead>
              <TableHead>{t("admins.columns.email")}</TableHead>
              <TableHead>{t("admins.columns.roles")}</TableHead>
              <TableHead>{t("admins.columns.status")}</TableHead>
              <TableHead>{t("admins.columns.createdAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow
                key={admin.id}
                className="cursor-pointer"
                onClick={() => onViewAdmin(admin.id)}
              >
                <TableCell className="font-medium text-foreground">
                  {admin.name}
                </TableCell>
                <TableCell>{admin.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {admin.roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {DATE_FORMAT.format(new Date(admin.createdAt))}
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && !adminsQuery.isPending && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {t("admins.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={adminsQuery.isFetching}
            onClick={() => setCursor(nextCursor)}
          >
            {adminsQuery.isFetching
              ? t("admins.loadingMore")
              : t("admins.loadMore")}
          </Button>
        </div>
      )}

      <InviteAdminDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        copy={{
          title: t("admins.invite.title"),
          description: t("admins.invite.description"),
          emailLabel: t("admins.invite.email.label"),
          emailPlaceholder: t("admins.invite.email.placeholder"),
          rolesLabel: t("admins.invite.rolesLabel"),
          rolesHelp: t("admins.invite.rolesHelp"),
          submitLabel: t("admins.invite.submitLabel"),
          submittingLabel: t("admins.invite.submittingLabel"),
          createdTitle: t("admins.invite.createdTitle"),
          createdDescription: t("admins.invite.createdDescription"),
          copyLink: t("admins.invite.copyLink"),
          copiedLabel: t("admins.invite.copiedLabel"),
          doneLabel: t("admins.invite.doneLabel"),
          cancelLabel: t("admins.disable.cancelLabel"),
        }}
        roles={rolesQuery.data?.data ?? []}
        onSubmit={handleInvite}
        errorMessage={inviteError}
        isPending={inviteMutation.isPending}
      />
    </div>
  )
}
