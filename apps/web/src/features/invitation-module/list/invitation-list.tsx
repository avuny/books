import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { Ban, Send } from "lucide-react"
import { useTranslation } from "react-i18next"
import { INVITATION_STATUSES } from "@avuny/contracts"

import {
  ConfirmDialog,
  DataTable,
  DataTablePagination,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { InvitationButton } from "../forms"
import {
  useInvitationAbilities,
  useInvitationList,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} from "../invitation-api"
import {
  canResendInvitation,
  canRevokeInvitation,
  getInvitationContact,
  useFormatDate,
  useInvitationLabels,
} from "../lib"
import type { InvitationStatusFilter, OrganizationInvitationDto } from "../types"
import { createInvitationColumns } from "./invitation-columns"
import { InvitationMobileCard } from "./invitation-mobile-card"

const STATUS_TABS: readonly InvitationStatusFilter[] = [
  "all",
  ...INVITATION_STATUSES,
]

type PendingAction = {
  kind: "resend" | "revoke"
  invitation: OrganizationInvitationDto
}

type InvitationListProps = {
  orgId: string
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function InvitationList({ orgId }: InvitationListProps) {
  const { t } = useTranslation("organization-invitation")

  const [status, setStatus] = useState<InvitationStatusFilter>("all")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((current) => ({ ...current, pageIndex: 0 })),
    []
  )

  const { invitations, total, isLoading, error } = useInvitationList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status,
  })
  const abilities = useInvitationAbilities(orgId)
  const { getStatusLabel, getChannelLabel, getTypeLabel } = useInvitationLabels()
  const formatDate = useFormatDate()
  const revokeMutation = useRevokeInvitationMutation(orgId)
  const resendMutation = useResendInvitationMutation(orgId)

  // Revoking the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && invitations.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((current) => ({
        ...current,
        pageIndex: current.pageIndex - 1,
      }))
    }
  }, [isLoading, invitations.length, pagination.pageIndex])

  /* --------------------------------- actions ------------------------------- */
  const getActions = useCallback(
    (invitation: OrganizationInvitationDto): RowAction[] => {
      const actions: RowAction[] = []

      if (abilities.canResend && canResendInvitation(invitation)) {
        actions.push({
          id: "resend",
          label: t("actions.resend"),
          icon: <Send className="size-4" />,
          onSelect: () => setPendingAction({ kind: "resend", invitation }),
        })
      }
      if (abilities.canRevoke && canRevokeInvitation(invitation)) {
        actions.push({
          id: "revoke",
          label: t("actions.revoke"),
          icon: <Ban className="size-4" />,
          variant: "destructive",
          separatorBefore: actions.length > 0,
          onSelect: () => setPendingAction({ kind: "revoke", invitation }),
        })
      }
      return actions
    },
    [t, abilities.canResend, abilities.canRevoke]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = useMemo(
    () =>
      createInvitationColumns({
        copy: {
          invitee: t("table.invitee"),
          type: t("table.type"),
          channel: t("table.channel"),
          status: t("table.status"),
          sent: t("table.sent"),
          expires: t("table.expires"),
          actions: t("table.actions"),
          existingUser: t("table.existingUser"),
          actionsFor: (invitee) => t("table.actionsFor", { name: invitee }),
          getTypeLabel,
          getChannelLabel,
          getStatusLabel,
          formatDate,
        },
        getActions,
      }),
    [t, getActions, getTypeLabel, getChannelLabel, getStatusLabel, formatDate]
  )

  const table = useDataTable<OrganizationInvitationDto>({
    data: invitations,
    columns,
    getRowId: (invitation) => invitation.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* ----------------------------- resend / revoke --------------------------- */
  const closeActionDialog = () => {
    setPendingAction(null)
    setActionError(null)
  }

  const handleConfirm = async () => {
    if (!pendingAction) return
    setActionError(null)
    const { kind, invitation } = pendingAction
    try {
      const variables = { orgId, invitationId: invitation.id }
      if (kind === "revoke") await revokeMutation.mutateAsync(variables)
      else await resendMutation.mutateAsync(variables)
      closeActionDialog()
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const actionKind = pendingAction?.kind ?? "revoke"
  const actionTarget = pendingAction
    ? (getInvitationContact(pendingAction.invitation) ??
      t("table.existingUser"))
    : ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">
            {t("list.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("list.description")}
          </p>
        </div>
        {abilities.canCreate ? <InvitationButton orgId={orgId} /> : null}
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={status}
        onValueChange={(value) => {
          const next = STATUS_TABS.find((item) => item === value)
          if (!next) return
          setStatus(next)
          resetPage()
        }}
        tabs={STATUS_TABS.map((item) => ({
          value: item,
          label: item === "all" ? t("list.tabs.all") : getStatusLabel(item),
        }))}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {parseApiError(error).message}
        </p>
      ) : null}

      <DataTable
        table={table}
        isLoading={isLoading}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("empty.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        }
        renderMobileCard={(row) => (
          <InvitationMobileCard
            invitation={row.original}
            copy={{
              existingUser: t("table.existingUser"),
              typeLabel: t("table.type"),
              channelLabel: t("table.channel"),
              sentLabel: t("table.sent"),
              expiresLabel: t("table.expires"),
              getTypeLabel,
              getChannelLabel,
              getStatusLabel,
              formatDate,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", {
              name:
                getInvitationContact(row.original) ?? t("table.existingUser"),
            })}
          />
        )}
        footer={
          <DataTablePagination
            {...paginationProps}
            copy={{
              navLabel: t("pagination.nav"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              rowsPerPage: t("pagination.rowsPerPage"),
              summary: ({ from, to, total: count }) =>
                t("pagination.summary", { from, to, total: count }),
              pageOf: (page, pageCount) =>
                t("pagination.pageOf", { page, pageCount }),
              pageLabel: (page) => t("pagination.goTo", { page }),
            }}
          />
        }
      />

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) closeActionDialog()
        }}
        title={t(`${actionKind}.title`)}
        description={
          actionError ?? t(`${actionKind}.description`, { name: actionTarget })
        }
        confirmLabel={t(`actions.${actionKind}`)}
        cancelLabel={t("actions.cancel")}
        isLoading={revokeMutation.isPending || resendMutation.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
