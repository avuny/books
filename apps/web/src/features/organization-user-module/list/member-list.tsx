import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { Crown, Pencil, UserCheck, UserX } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  ConfirmDialog,
  DataTable,
  DataTablePagination,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"
import { Input } from "@workspace/ui/components/input"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { EditMemberDialog, TransferOwnershipDialog } from "../forms"
import {
  canEditMember,
  canToggleMemberStatus,
  canTransferOwnershipTo,
  useDebouncedValue,
  useFormatDate,
  useMemberLabels,
} from "../lib"
import {
  useMemberAbilities,
  useMemberList,
  useSetMemberStatusMutation,
} from "../organization-user-api"
import type { MemberStatusFilter, OrganizationUserDto } from "../types"
import { createMemberColumns } from "./member-columns"
import { MemberMobileCard } from "./member-mobile-card"

const STATUS_TABS: readonly MemberStatusFilter[] = ["all", "active", "inactive"]

type OrganizationUserListProps = {
  orgId: string
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function OrganizationUserList({ orgId }: OrganizationUserListProps) {
  const { t } = useTranslation("organization-user")

  const [status, setStatus] = useState<MemberStatusFilter>("all")
  const [searchInput, setSearchInput] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const [memberToEdit, setMemberToEdit] = useState<OrganizationUserDto | null>(
    null
  )
  const [memberToTransfer, setMemberToTransfer] =
    useState<OrganizationUserDto | null>(null)
  const [memberToToggle, setMemberToToggle] =
    useState<OrganizationUserDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((current) => ({ ...current, pageIndex: 0 })),
    []
  )

  const search = useDebouncedValue(searchInput.trim())

  const { members, total, isLoading, error } = useMemberList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status,
    search,
  })
  const abilities = useMemberAbilities(orgId)
  const { getStatusLabel } = useMemberLabels()
  const formatDate = useFormatDate()
  const statusMutation = useSetMemberStatusMutation(orgId)

  // Deactivating the last row of a filtered last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && members.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((current) => ({
        ...current,
        pageIndex: current.pageIndex - 1,
      }))
    }
  }, [isLoading, members.length, pagination.pageIndex])

  /* --------------------------------- actions ------------------------------- */
  const getActions = useCallback(
    (member: OrganizationUserDto): RowAction[] => {
      const actions: RowAction[] = []

      if (abilities.canUpdate && canEditMember(member)) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setMemberToEdit(member),
        })
      }
      if (abilities.canUpdate && canToggleMemberStatus(member)) {
        const deactivating = member.isActive
        actions.push({
          id: deactivating ? "deactivate" : "activate",
          label: t(deactivating ? "actions.deactivate" : "actions.activate"),
          icon: deactivating ? (
            <UserX className="size-4" />
          ) : (
            <UserCheck className="size-4" />
          ),
          ...(deactivating ? { variant: "destructive" as const } : {}),
          onSelect: () => setMemberToToggle(member),
        })
      }
      if (abilities.canTransferOwnership && canTransferOwnershipTo(member)) {
        actions.push({
          id: "transfer",
          label: t("actions.transferOwnership"),
          icon: <Crown className="size-4" />,
          separatorBefore: actions.length > 0,
          onSelect: () => setMemberToTransfer(member),
        })
      }
      return actions
    },
    [t, abilities.canUpdate, abilities.canTransferOwnership]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = useMemo(
    () =>
      createMemberColumns({
        copy: {
          member: t("table.member"),
          identifier: t("table.identifier"),
          status: t("table.status"),
          joined: t("table.joined"),
          lastAccessed: t("table.lastAccessed"),
          actions: t("table.actions"),
          never: t("table.never"),
          actionsFor: (name) => t("table.actionsFor", { name }),
          getStatusLabel,
          formatDate,
        },
        getActions,
      }),
    [t, getActions, getStatusLabel, formatDate]
  )

  const table = useDataTable<OrganizationUserDto>({
    data: members,
    columns,
    getRowId: (member) => member.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* ---------------------------- activate / deactivate ---------------------- */
  const closeToggleDialog = () => {
    setMemberToToggle(null)
    setActionError(null)
  }

  const handleToggleConfirm = async () => {
    if (!memberToToggle) return
    setActionError(null)
    try {
      await statusMutation.mutateAsync({
        orgId,
        memberId: memberToToggle.id,
        data: { isActive: !memberToToggle.isActive },
      })
      closeToggleDialog()
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const toggleKind =
    memberToToggle?.isActive === false ? "activate" : "deactivate"

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">
          {t("list.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value)
            resetPage()
          }}
          placeholder={t("list.search.placeholder")}
          aria-label={t("list.search.label")}
          className="sm:max-w-xs"
        />
        <DataTableViewTabs
          ariaLabel={t("list.tabs.statusAria")}
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
      </div>

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
            <p className="font-medium text-foreground">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        }
        renderMobileCard={(row) => (
          <MemberMobileCard
            member={row.original}
            copy={{
              identifierLabel: t("table.identifier"),
              never: t("table.never"),
              joinedLabel: t("table.joined"),
              lastAccessedLabel: t("table.lastAccessed"),
              getStatusLabel,
              formatDate,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", {
              name: row.original.username,
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

      <EditMemberDialog
        orgId={orgId}
        member={memberToEdit}
        onOpenChange={(open) => {
          if (!open) setMemberToEdit(null)
        }}
        onSuccess={() => setMemberToEdit(null)}
      />

      <TransferOwnershipDialog
        orgId={orgId}
        member={memberToTransfer}
        onOpenChange={(open) => {
          if (!open) setMemberToTransfer(null)
        }}
        onSuccess={() => setMemberToTransfer(null)}
      />

      <ConfirmDialog
        open={memberToToggle !== null}
        onOpenChange={(open) => {
          if (!open) closeToggleDialog()
        }}
        title={t(`${toggleKind}.title`)}
        description={
          actionError ??
          t(`${toggleKind}.description`, { name: memberToToggle?.username })
        }
        confirmLabel={t(`actions.${toggleKind}`)}
        cancelLabel={t("actions.cancel")}
        isLoading={statusMutation.isPending}
        onConfirm={handleToggleConfirm}
      />
    </div>
  )
}
