"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { getPageItems } from "./data-table-utils"

export interface DataTablePaginationCopy {
  navLabel: string
  previous: string
  next: string
  rowsPerPage: string
  /** e.g. t("pagination.summary", { from, to, total }) */
  summary: (args: { from: number; to: number; total: number }) => string
  /** Compact label for small screens, e.g. "Page 2 of 9". */
  pageOf: (page: number, pageCount: number) => string
  /** aria-label of a page button, e.g. "Go to page 3". */
  pageLabel: (page: number) => string
}

export interface DataTablePaginationProps {
  /** 1-based. */
  page: number
  pageCount: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  copy: DataTablePaginationCopy
  className?: string
}

export function DataTablePagination({
  page,
  pageCount,
  pageSize,
  total,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  copy,
  className,
}: DataTablePaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const items = getPageItems(page, pageCount)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <p className="text-sm text-muted-foreground">
          {copy.summary({ from, to, total })}
        </p>
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{copy.rowsPerPage}</span>
            <select
              value={pageSize}
              aria-label={copy.rowsPerPage}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <nav
        aria-label={copy.navLabel}
        className="flex items-center justify-between gap-1 sm:justify-end"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {copy.previous}
        </Button>

        <span className="text-sm text-muted-foreground sm:hidden">
          {copy.pageOf(page, pageCount)}
        </span>

        <ol className="hidden items-center gap-1 sm:flex">
          {items.map((item) =>
            typeof item === "number" ? (
              <li key={item}>
                <Button
                  type="button"
                  size="sm"
                  variant={item === page ? "default" : "outline"}
                  className="min-w-8 px-2"
                  aria-current={item === page ? "page" : undefined}
                  aria-label={copy.pageLabel(item)}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              </li>
            ) : (
              <li
                key={item}
                aria-hidden
                className="px-1 text-sm text-muted-foreground"
              >
                …
              </li>
            )
          )}
        </ol>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {copy.next}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </nav>
    </div>
  )
}
