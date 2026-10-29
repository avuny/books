"use client"

import * as React from "react"
import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table"

import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { isInteractiveTarget } from "./data-table-utils"

export interface DataTableProps<TData> {
  /** A TanStack table instance (see useDataTable). */
  table: TanstackTable<TData>
  isLoading?: boolean
  loadingRowCount?: number
  /** Shown when there are no rows. Inject already-translated content. */
  emptyState: React.ReactNode
  onRowClick?: (row: TData) => void
  /**
   * Below `md` the table is replaced by this card list.
   * Without it, the table scrolls horizontally on small screens.
   */
  renderMobileCard?: (row: Row<TData>) => React.ReactNode
  /** Usually <DataTablePagination />. */
  footer?: React.ReactNode
  className?: string
}

export function DataTable<TData>({
  table,
  isLoading = false,
  loadingRowCount = 8,
  emptyState,
  onRowClick,
  renderMobileCard,
  footer,
  className,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length
  const skeletonRows = Array.from({ length: loadingRowCount }, (_, i) => i)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
        className
      )}
      aria-busy={isLoading}
    >
      <div className={cn(renderMobileCard ? "hidden md:block" : "block")}>
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        header.column.getCanSort()
                          ? sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                      className={cn(
                        "h-11 text-xs font-medium text-muted-foreground",
                        header.column.columnDef.meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              skeletonRows.map((i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {Array.from({ length: columnCount }, (_, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if (isInteractiveTarget(event.target)) return
                          onRowClick(row.original)
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {renderMobileCard ? (
        <div className="md:hidden">
          {isLoading ? (
            <ul className="divide-y divide-border">
              {skeletonRows.slice(0, 4).map((i) => (
                <li key={i} className="space-y-3 p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            emptyState
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id}>{renderMobileCard(row)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {footer ? (
        <div className="border-t border-border p-3">{footer}</div>
      ) : null}
    </div>
  )
}
