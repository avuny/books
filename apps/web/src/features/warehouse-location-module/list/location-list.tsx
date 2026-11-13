import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import {
  DataTable,
  DataTablePagination,
  DataTableSearch,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { useWarehouseLocationLabels } from "../lib"
import type { LocationScope, WarehouseLocationListItemDto } from "../types"
import { useLocationList } from "../warehouse-location-api"
import { createLocationColumns } from "./location-columns"
import { LocationMobileCard } from "./location-mobile-card"

const SCOPES: readonly LocationScope[] = ["all", "stockable", "blocked", "inactive"]

type LocationListProps = {
  orgId: string
  warehouseId: string
  /** Row menu entries; the explorer owns the actions so the table and the tree share them. */
  getActions: (location: WarehouseLocationListItemDto) => RowAction[]
  /** The route decides how to navigate to the location page. */
  onViewLocation: (locationId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function LocationList({ orgId, warehouseId, getActions, onViewLocation }: LocationListProps) {
  const { t } = useTranslation("warehouse-location")

  /* state */
  const [scope, setScope] = useState<LocationScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const resetPage = useCallback(() => setPagination((c) => ({ ...c, pageIndex: 0 })), [])

  /* data */
  const { locations, total, isLoading } = useLocationList(orgId, {
    warehouseId,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    scope,
    search,
  })
  const { getTypeLabel, getPurposeLabel } = useWarehouseLocationLabels()

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && locations.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
    }
  }, [isLoading, locations.length, pagination.pageIndex])

  const badges = useMemo(
    () => ({
      inactive: t("badges.inactive"),
      blocked: t("badges.blocked"),
      inheritedBlock: t("badges.inheritedBlock"),
    }),
    [t]
  )

  /* columns + table */
  const columns = useMemo(
    () =>
      createLocationColumns({
        copy: {
          fullCode: t("table.fullCode"),
          name: t("table.name"),
          type: t("table.type"),
          purpose: t("table.purpose"),
          actions: t("table.actions"),
          actionsFor: (name) => t("table.actionsFor", { name }),
          getTypeLabel,
          getPurposeLabel,
          badges,
        },
        getActions,
      }),
    [t, getTypeLabel, getPurposeLabel, badges, getActions]
  )

  const table = useDataTable<WarehouseLocationListItemDto>({
    data: locations,
    columns,
    getRowId: (l) => l.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })
  const paginationProps = getTablePaginationProps(table)

  return (
    <div className="flex flex-col gap-4">
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

      <DataTableSearch
        value={search}
        onChange={(next) => {
          setSearch(next)
          resetPage()
        }}
        placeholder={t("list.search.placeholder")}
        clearLabel={t("list.search.clear")}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(l) => onViewLocation(l.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        }
        renderMobileCard={(row) => (
          <LocationMobileCard
            location={row.original}
            copy={{
              nameLabel: t("table.name"),
              typeLabel: t("table.type"),
              purposeLabel: t("table.purpose"),
              getTypeLabel,
              getPurposeLabel,
              badges,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", { name: row.original.name })}
            onClick={() => onViewLocation(row.original.id)}
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
    </div>
  )
}
