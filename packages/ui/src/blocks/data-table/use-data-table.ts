"use client"

import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table"

export interface UseDataTableOptions<TData> {
  data: TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  getRowId?: (row: TData, index: number) => string
  /**
   * `true` = the server sorts and paginates (pass `rowCount`).
   * `false` = TanStack sorts and paginates the `data` array in memory.
   */
  manual?: boolean
  /** Total rows across all pages. Required when `manual` is true. */
  rowCount?: number
  initialPageSize?: number
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)

  // Optional controlled state. Leave undefined to let the table manage it.
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
}

/**
 * Thin wrapper around useReactTable with the defaults every module needs.
 * Only controlled values that are actually provided are forwarded, because
 * passing `undefined` to TanStack would override its internal state.
 */
export function useDataTable<TData>({
  data,
  columns,
  getRowId,
  manual = false,
  rowCount,
  initialPageSize = 20,
  enableRowSelection = false,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  columnFilters,
  onColumnFiltersChange,
}: UseDataTableOptions<TData>): Table<TData> {
  return useReactTable({
    data,
    columns,
    getRowId,
    enableRowSelection,
    initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } },
    state: {
      ...(sorting !== undefined && { sorting }),
      ...(pagination !== undefined && { pagination }),
      ...(rowSelection !== undefined && { rowSelection }),
      ...(columnVisibility !== undefined && { columnVisibility }),
      ...(columnFilters !== undefined && { columnFilters }),
    },
    ...(onSortingChange && { onSortingChange }),
    ...(onPaginationChange && { onPaginationChange }),
    ...(onRowSelectionChange && { onRowSelectionChange }),
    ...(onColumnVisibilityChange && { onColumnVisibilityChange }),
    ...(onColumnFiltersChange && { onColumnFiltersChange }),
    manualSorting: manual,
    manualPagination: manual,
    ...(manual && rowCount !== undefined && { rowCount }),
    getCoreRowModel: getCoreRowModel(),
    ...(!manual && {
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
    }),
  })
}

/**
 * Maps a table instance to the props of <DataTablePagination />
 * (which is 1-based and knows nothing about TanStack).
 */
export function getTablePaginationProps<TData>(table: Table<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination
  return {
    page: pageIndex + 1,
    pageCount: Math.max(table.getPageCount(), 1),
    pageSize,
    total: table.getRowCount(),
    onPageChange: (page: number) => table.setPageIndex(page - 1),
    onPageSizeChange: (size: number) => table.setPageSize(size),
  }
}
