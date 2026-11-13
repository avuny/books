import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import {
  DataTable,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
} from "@workspace/ui/blocks/data-table"

import { useWarehouseActions } from "../actions"
import { WarehouseButton } from "../forms"
import { useWarehouseLabels } from "../lib"
import type { WarehouseListItemDto, WarehouseScope } from "../types"
import { useWarehouseList } from "../warehouse-api"
import { createWarehouseColumns } from "./warehouse-columns"
import { WarehouseMobileCard } from "./warehouse-mobile-card"

const SCOPES: readonly WarehouseScope[] = ["all", "active", "inactive"]

type WarehouseListProps = {
  orgId: string
  /** The route decides how to navigate to the warehouse page. */
  onViewWarehouse: (warehouseId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function WarehouseList({ orgId, onViewWarehouse }: WarehouseListProps) {
  const { t } = useTranslation("warehouse")

  /* state */
  const [scope, setScope] = useState<WarehouseScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const resetPage = useCallback(() => setPagination((c) => ({ ...c, pageIndex: 0 })), [])

  /* data */
  const { warehouses, total, isLoading } = useWarehouseList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    scope,
    search,
  })
  const { getTypeLabel } = useWarehouseLabels()
  const { abilities, getActions, dialogs, actionError, clearActionError } = useWarehouseActions(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && warehouses.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
    }
  }, [isLoading, warehouses.length, pagination.pageIndex])

  const badges = useMemo(
    () => ({ default: t("badges.default"), system: t("badges.system"), inactive: t("badges.inactive") }),
    [t]
  )
  const rowActions = useCallback(
    (warehouse: WarehouseListItemDto) => getActions(warehouse, { onView: () => onViewWarehouse(warehouse.id) }),
    [getActions, onViewWarehouse]
  )

  /* columns + table */
  const columns = useMemo(
    () =>
      createWarehouseColumns({
        copy: {
          code: t("table.code"),
          name: t("table.name"),
          type: t("table.type"),
          actions: t("table.actions"),
          actionsFor: (name) => t("table.actionsFor", { name }),
          getTypeLabel,
          badges,
        },
        getActions: rowActions,
      }),
    [t, getTypeLabel, badges, rowActions]
  )

  const table = useDataTable<WarehouseListItemDto>({
    data: warehouses,
    columns,
    getRowId: (w) => w.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })
  const paginationProps = getTablePaginationProps(table)

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{t("list.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive" onClick={clearActionError}>
          {actionError}
        </p>
      ) : null}

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={scope}
        onValueChange={(value) => {
          const next = SCOPES.find((item) => item === value) // narrow string → union safely
          if (!next) return
          setScope(next)
          resetPage()
        }}
        tabs={SCOPES.map((item) => ({ value: item, label: t(`list.tabs.${item}`) }))}
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
        actions={abilities.canCreate ? <WarehouseButton orgId={orgId} /> : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(w) => onViewWarehouse(w.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        }
        renderMobileCard={(row) => (
          <WarehouseMobileCard
            warehouse={row.original}
            copy={{ codeLabel: t("table.code"), typeLabel: t("table.type"), getTypeLabel, badges }}
            actions={rowActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", { name: row.original.name })}
            onClick={() => onViewWarehouse(row.original.id)}
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
              summary: ({ from, to, total: count }) => t("pagination.summary", { from, to, total: count }),
              pageOf: (page, pageCount) => t("pagination.pageOf", { page, pageCount }),
              pageLabel: (page) => t("pagination.goTo", { page }),
            }}
          />
        }
      />

      {dialogs}
    </div>
  )
}
