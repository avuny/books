"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { RotateCcw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { AsyncCombobox } from "@workspace/ui/blocks/form"
import type { DataTablePaginationCopy } from "@workspace/ui/blocks/data-table"

import {
  WarehouseLocationFilter,
  type WarehouseLocationFilterValue,
} from "../../warehouse-module"
import { useItemOptions } from "../../item-module"
import { useAsyncComboboxCopy } from "../../lib/options/use-async-combobox-copy"

import type {
  DisplayUnitOption,
  StockMovementListProps,
  StockMovementType,
} from "../types"
import { useItemUnitOptions, useStockMovements } from "../stock-movement-api"
import { DisplayUnitSelector } from "../components/display-unit-selector"
import { MovementTypeSelect } from "../components/movement-type-select"
import { StockMovementTable } from "./stock-movement-table"

export function StockMovementList({
  orgId,
  fixedItemId,
  className,
}: StockMovementListProps) {
  const { t, i18n } = useTranslation("stock-movement")

  // Filter state
  const [selectedItemId, setSelectedItemId] = React.useState<string | undefined>(undefined)
  const [warehouseFilter, setWarehouseFilter] = React.useState<WarehouseLocationFilterValue>({
    warehouseIds: [],
    locationIds: [],
  })
  const [movementType, setMovementType] = React.useState<StockMovementType | undefined>(undefined)
  const [fromDate, setFromDate] = React.useState<string>("")
  const [toDate, setToDate] = React.useState<string>("")

  // Pagination state
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  // Scope determines whether we are showing a single item or multiple items
  const isItemScoped = Boolean(fixedItemId)
  const effectiveItemId = fixedItemId || selectedItemId
  const isSingleItemScope = Boolean(effectiveItemId)

  // Asynchronous item source for general view
  const itemSource = useItemOptions(orgId)
  const itemComboboxCopy = useAsyncComboboxCopy()

  // Fetch unit collection options for the scoped item
  const { data: itemUnitOptions = [] } = useItemUnitOptions(orgId, effectiveItemId)

  // Selected display unit state
  const [selectedUnit, setSelectedUnit] = React.useState<DisplayUnitOption | null>(null)

  // When scoped item changes or unit options load, default to base unit
  React.useEffect(() => {
    if (!effectiveItemId) {
      setSelectedUnit(null)
      return
    }
    if (itemUnitOptions.length > 0) {
      const base = itemUnitOptions.find((u) => u.isBase) ?? itemUnitOptions[0]
      setSelectedUnit(base ?? null)
    }
  }, [effectiveItemId, itemUnitOptions])

  // Build API query parameters
  const queryParams = React.useMemo(() => {
    return {
      page,
      pageSize,
      itemId: effectiveItemId || undefined,
      warehouseId: warehouseFilter.warehouseIds.length === 1 ? warehouseFilter.warehouseIds[0] : undefined,
      locationId: warehouseFilter.locationIds.length === 1 ? warehouseFilter.locationIds[0] : undefined,
      type: movementType,
      from: fromDate ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
    }
  }, [page, pageSize, effectiveItemId, warehouseFilter, movementType, fromDate, toDate])

  const { items, total, isLoading } = useStockMovements(orgId, queryParams)

  // Reset pagination when any filter changes
  const handleItemFilterChange = (id: string | null) => {
    setSelectedItemId(id || undefined)
    setPage(1)
  }

  const handleWarehouseFilterChange = (val: WarehouseLocationFilterValue) => {
    setWarehouseFilter(val)
    setPage(1)
  }

  const handleTypeChange = (type?: StockMovementType) => {
    setMovementType(type)
    setPage(1)
  }

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromDate(e.target.value)
    setPage(1)
  }

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToDate(e.target.value)
    setPage(1)
  }

  const resetFilters = () => {
    if (!isItemScoped) setSelectedItemId(undefined)
    setWarehouseFilter({ warehouseIds: [], locationIds: [] })
    setMovementType(undefined)
    setFromDate("")
    setToDate("")
    setPage(1)
  }

  const hasActiveFilters =
    (!isItemScoped && Boolean(selectedItemId)) ||
    warehouseFilter.warehouseIds.length > 0 ||
    warehouseFilter.locationIds.length > 0 ||
    Boolean(movementType) ||
    Boolean(fromDate) ||
    Boolean(toDate)

  // Date formatter
  const formatDate = React.useCallback(
    (iso: string) => {
      try {
        return new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(iso))
      } catch {
        return iso
      }
    },
    [i18n.language]
  )

  // Copy strings
  const copy = React.useMemo(
    () => ({
      title: t("table.title", "Stock Movements"),
      description: t(
        "table.description",
        "Ledger of physical inventory movements, receipts, issues, and adjustments."
      ),
      reference: t("table.reference", "Reference"),
      date: t("table.date", "Date"),
      item: t("table.item", "Item"),
      movementType: t("table.movementType", "Movement Type"),
      warehouseLocation: t("table.warehouseLocation", "Warehouse - Location"),
      direction: t("table.direction", "Direction"),
      quantity: t("table.quantity", "Quantity"),
      runningBalance: t("table.runningBalance", "Running Balance"),
      empty: hasActiveFilters
        ? t("table.emptyFiltered", "No stock movements match the selected filters.")
        : t("table.empty", "No stock movements recorded."),
      pagination: {
        navLabel: t("pagination.navLabel", "Pagination"),
        previous: t("pagination.previous", "Previous"),
        next: t("pagination.next", "Next"),
        rowsPerPage: t("pagination.rowsPerPage", "Rows per page"),
        summary: ({ from, to, total }: { from: number; to: number; total: number }) =>
          t("pagination.summary", {
            from,
            to,
            total,
            defaultValue: `${from}–${to} of ${total}`,
          }),
        pageOf: (p: number, totalP: number) =>
          t("pagination.pageOf", {
            page: p,
            pageCount: totalP,
            defaultValue: `Page ${p} of ${totalP}`,
          }),
        pageLabel: (p: number) =>
          t("pagination.pageLabel", {
            page: p,
            defaultValue: `Go to page ${p}`,
          }),
      } as DataTablePaginationCopy,
    }),
    [t, hasActiveFilters]
  )

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {/* Header bar (when standalone in General page) */}
      {!isItemScoped && (
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Item Selector (Visible only in General view) */}
          {!isItemScoped && (
            <div className="w-56">
              <AsyncCombobox
                source={itemSource}
                value={selectedItemId ?? null}
                onValueChange={handleItemFilterChange}
                placeholder={t("filter.item", "Filter by item...")}
                copy={itemComboboxCopy}
              />
            </div>
          )}

          {/* Warehouse & Location Filter (Strictly physical) */}
          <WarehouseLocationFilter
            orgId={orgId}
            value={warehouseFilter}
            onChange={handleWarehouseFilterChange}
            physicalOnly
          />

          {/* Movement Type Filter */}
          <MovementTypeSelect
            value={movementType}
            onChange={handleTypeChange}
          />

          {/* Date range filter */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Input
                type="date"
                value={fromDate}
                onChange={handleFromDateChange}
                className="h-9 w-32 px-2 text-xs"
                aria-label={t("filter.fromDate", "From date")}
                title={t("filter.fromDate", "From date")}
              />
            </div>
            <span className="text-xs text-muted-foreground">—</span>
            <div className="relative">
              <Input
                type="date"
                value={toDate}
                onChange={handleToDateChange}
                className="h-9 w-32 px-2 text-xs"
                aria-label={t("filter.toDate", "To date")}
                title={t("filter.toDate", "To date")}
              />
            </div>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              <span>{t("filter.reset", "Reset")}</span>
            </Button>
          )}
        </div>

        {/* Display Unit Selector (Visible when scoped to single item) */}
        {isSingleItemScope && itemUnitOptions.length > 0 && (
          <div className="ms-auto flex items-center">
            <DisplayUnitSelector
              options={itemUnitOptions}
              selectedUnitId={selectedUnit?.id}
              onChange={(unit) => setSelectedUnit(unit)}
            />
          </div>
        )}
      </div>

      {/* Table view */}
      <StockMovementTable
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        onPaginationChange={(p, ps) => {
          setPage(p)
          setPageSize(ps)
        }}
        isLoading={isLoading}
        hideItemColumn={isItemScoped}
        displayUnit={isSingleItemScope ? selectedUnit : null}
        copy={copy}
        formatDate={formatDate}
      />
    </div>
  )
}
