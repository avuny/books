import * as React from "react"
import {
  DataTable,
  DataTablePagination,
  getTablePaginationProps,
  useDataTable,
  type DataTablePaginationCopy,
} from "@workspace/ui/blocks/data-table"
import type { DisplayUnitOption, StockMovementLineHistoryItem } from "../types"
import { createStockMovementColumns } from "./stock-movement-columns"
import { StockMovementMobileCard } from "./stock-movement-mobile-card"

export interface StockMovementTableProps {
  items: StockMovementLineHistoryItem[]
  total: number
  page: number
  pageSize: number
  onPaginationChange: (page: number, pageSize: number) => void
  isLoading?: boolean
  hideItemColumn?: boolean
  displayUnit?: DisplayUnitOption | null
  copy: {
    empty: string
    reference: string
    date: string
    item: string
    movementType: string
    warehouseLocation: string
    direction: string
    quantity: string
    runningBalance: string
    pagination: DataTablePaginationCopy
  }
  formatDate: (iso: string) => string
  className?: string
}

export function StockMovementTable({
  items,
  total,
  page,
  pageSize,
  onPaginationChange,
  isLoading = false,
  hideItemColumn = false,
  displayUnit,
  copy,
  formatDate,
  className,
}: StockMovementTableProps) {
  const columns = React.useMemo(
    () =>
      createStockMovementColumns({
        hideItemColumn,
        displayUnit,
        copy: {
          reference: copy.reference,
          date: copy.date,
          item: copy.item,
          movementType: copy.movementType,
          warehouseLocation: copy.warehouseLocation,
          direction: copy.direction,
          quantity: copy.quantity,
          runningBalance: copy.runningBalance,
        },
        formatDate,
      }),
    [hideItemColumn, displayUnit, copy, formatDate]
  )

  const paginationState = React.useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize,
    }),
    [page, pageSize]
  )

  const table = useDataTable<StockMovementLineHistoryItem>({
    data: items,
    columns,
    getRowId: (row) => row.lineId,
    manual: true,
    rowCount: total,
    pagination: paginationState,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(paginationState) : updater
      onPaginationChange(next.pageIndex + 1, next.pageSize)
    },
  })

  const paginationProps = getTablePaginationProps(table)

  return (
    <div className={className}>
      <DataTable
        table={table}
        isLoading={isLoading}
        emptyState={
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-sm font-medium text-foreground">{copy.empty}</p>
          </div>
        }
        renderMobileCard={(row) => (
          <StockMovementMobileCard
            item={row.original}
            hideItemColumn={hideItemColumn}
            displayUnit={displayUnit}
            formatDate={formatDate}
            copy={copy}
          />
        )}
        footer={<DataTablePagination {...paginationProps} copy={copy.pagination} />}
      />
    </div>
  )
}
