import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  ConfirmDialog,
  DataTable,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { RoleButton, RoleDialog } from "../forms"
import { usePermissionLabels } from "../lib"
import {
  useDeleteRoleMutation,
  useRoleAbilities,
  useRoleList,
} from "../role-api"
import type { RoleListItemDto, RoleScope } from "../types"
import { createRoleColumns } from "./role-columns"
import { RoleMobileCard } from "./role-mobile-card"
import { parseApiError } from "@workspace/ui/lib/api-error"

const SCOPES: readonly RoleScope[] = ["all", "system", "custom"]

type RoleListProps = {
  orgId: string
  /** The route decides how to navigate to the role page. */
  onViewRole: (roleId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function RoleList({ orgId, onViewRole }: RoleListProps) {
  const { t } = useTranslation("role")

  const [scope, setScope] = useState<RoleScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [roleToEdit, setRoleToEdit] = useState<RoleListItemDto | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<RoleListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((current) => ({ ...current, pageIndex: 0 })),
    []
  )

  const { roles, total, isLoading } = useRoleList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    scope,
    search,
  })
  const abilities = useRoleAbilities(orgId)
  const { getRoleName } = usePermissionLabels()
  const deleteMutation = useDeleteRoleMutation(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && roles.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((current) => ({
        ...current,
        pageIndex: current.pageIndex - 1,
      }))
    }
  }, [isLoading, roles.length, pagination.pageIndex])

  /* --------------------------------- actions ------------------------------- */
  const getActions = useCallback(
    (role: RoleListItemDto): RowAction[] => {
      const actions: RowAction[] = [
        {
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewRole(role.id),
        },
      ]
      // System roles are read-only on the server.
      if (role.isSystem) return actions

      if (abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setRoleToEdit(role),
        })
      }
      if (abilities.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          // A role still assigned to members can't be deleted.
          disabled: role.memberCount > 0,
          onSelect: () => setRoleToDelete(role),
        })
      }
      return actions
    },
    [t, onViewRole, abilities.canUpdate, abilities.canDelete]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = useMemo(
    () =>
      createRoleColumns({
        copy: {
          name: t("table.name"),
          type: t("table.type"),
          members: t("table.members"),
          permissions: t("table.permissions"),
          actions: t("table.actions"),
          systemLabel: t("type.system"),
          customLabel: t("type.custom"),
          actionsFor: (roleName) => t("table.actionsFor", { name: roleName }),
          getRoleName,
        },
        getActions,
      }),
    [t, getActions, getRoleName]
  )

  const table = useDataTable<RoleListItemDto>({
    data: roles,
    columns,
    getRowId: (role) => role.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* --------------------------------- delete -------------------------------- */
  const closeDeleteDialog = () => {
    setRoleToDelete(null)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!roleToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, roleId: roleToDelete.id })
      closeDeleteDialog()
    } catch (e) {
      setDeleteError(parseApiError(e).message || null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">
          {t("list.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={scope}
        onValueChange={(value) => {
          const next = SCOPES.find((item) => item === value)
          if (!next) return
          setScope(next)
          resetPage()
        }}
        tabs={SCOPES.map((item) => ({
          value: item,
          label: t(`list.tabs.${item}`),
        }))}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => {
              setSearch(next)
              resetPage()
            }}
            placeholder={t("list.search.placeholder")}
            clearLabel={t("list.search.clear")}
          />
        }
        actions={abilities.canCreate ? <RoleButton orgId={orgId} /> : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(role) => onViewRole(role.id)}
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
          <RoleMobileCard
            role={row.original}
            copy={{
              systemLabel: t("type.system"),
              customLabel: t("type.custom"),
              membersLabel: t("table.members"),
              permissionsLabel: t("table.permissions"),
              roleName: getRoleName,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", {
              name: row.original.name,
            })}
            onClick={() => onViewRole(row.original.id)}
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

      {roleToEdit ? (
        <RoleDialog
          orgId={orgId}
          roleId={roleToEdit.id}
          open
          onOpenChange={(open) => {
            if (!open) setRoleToEdit(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        title={t("delete.title")}
        description={
          deleteError ?? t("delete.description", { name: roleToDelete?.name })
        }
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
