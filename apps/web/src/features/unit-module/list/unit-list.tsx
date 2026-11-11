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
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { UnitButton, UnitDialog } from "../forms"
import {
  useDeleteUnitMutation,
  useUnitAbilities,
  useUnitList,
} from "../unit-api"
import type { UnitDto } from "../types"
import { createUnitColumns, type UnitColumnsCopy } from "./unit-columns"
import { UnitMobileCard } from "./unit-mobile-card"

type UnitListProps = {
  orgId: string
  onViewUnit?: (unitId: string) => void
}

export function UnitList({ orgId, onViewUnit }: UnitListProps) {
  const { t, i18n } = useTranslation("unit")
  const abilities = useUnitAbilities(orgId)
  const deleteMutation = useDeleteUnitMutation(orgId)

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    }, 250)
    return () => clearTimeout(handle)
  }, [search])

  const { items, total, isLoading } = useUnitList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: debouncedSearch || undefined,
  })

  const [unitToEdit, setUnitToEdit] = useState<UnitDto | null>(null)
  const [unitToDelete, setUnitToDelete] = useState<UnitDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const formatDate = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
      }).format(new Date(iso)),
    [i18n.language]
  )

  const getActions = useCallback(
    (unit: UnitDto): RowAction[] => {
      const actions: RowAction[] = []

      if (onViewUnit) {
        actions.push({
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewUnit(unit.id),
        })
      }

      // System units cannot be edited or deleted
      if (!unit.isSystem && abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setUnitToEdit(unit),
        })
      }

      if (!unit.isSystem && abilities.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          onSelect: () => setUnitToDelete(unit),
        })
      }

      return actions
    },
    [t, onViewUnit, abilities.canUpdate, abilities.canDelete]
  )

  const columnsCopy = useMemo<UnitColumnsCopy>(
    () => ({
      name: t("table.name"),
      symbol: t("table.symbol"),
      type: t("table.type"),
      scope: t("table.scope"),
      status: t("table.status"),
      updated: t("table.updated"),
      actions: t("table.actions"),
      actionsFor: (name) => t("table.actionsFor", { name }),
      formatDate,
      types: {
        count: t("type.count"),
        weight: t("type.weight"),
        length: t("type.length"),
        area: t("type.area"),
        volume: t("type.volume"),
      },
      labels: {
        system: t("labels.system"),
        custom: t("labels.custom"),
        active: t("status.active"),
        inactive: t("status.inactive"),
      },
    }),
    [t, formatDate]
  )

  const columns = useMemo(
    () =>
      createUnitColumns({
        copy: columnsCopy,
        getActions,
      }),
    [columnsCopy, getActions]
  )

  const table = useDataTable<UnitDto>({
    data: items,
    columns,
    getRowId: (unit) => unit.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  const closeDeleteDialog = () => {
    setUnitToDelete(null)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!unitToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({
        orgId,
        unitId: unitToDelete.id,
      })
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

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => {
              setSearch(next)
            }}
            placeholder={t("list.search.placeholder")}
            clearLabel={t("list.search.clear")}
          />
        }
        actions={abilities.canCreate ? <UnitButton orgId={orgId} /> : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={onViewUnit ? (unit) => onViewUnit(unit.id) : undefined}
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
          <UnitMobileCard
            unit={row.original}
            copy={columnsCopy}
            onSelect={onViewUnit ? () => onViewUnit(row.original.id) : undefined}
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

      {unitToEdit && (
        <UnitDialog
          orgId={orgId}
          open={Boolean(unitToEdit)}
          onOpenChange={(open) => !open && setUnitToEdit(null)}
          unit={unitToEdit}
        />
      )}

      <ConfirmDialog
        open={unitToDelete !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        title={t("delete.title")}
        description={
          deleteError ??
          t("delete.description", {
            name: unitToDelete?.name,
            symbol: unitToDelete?.symbol,
          })
        }
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
