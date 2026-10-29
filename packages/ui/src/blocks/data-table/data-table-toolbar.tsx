import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

export interface DataTableToolbarProps {
  /** <DataTableSearch /> */
  search?: ReactNode
  /** <DataTableFilter /> */
  filter?: ReactNode
  /** Import / export menus, primary "Create" button ... */
  actions?: ReactNode
  /** Below the main row: <DataTableActiveFilters />, <DataTableBulkBar /> ... */
  children?: ReactNode
  className?: string
}

/**
 * Layout only. Mobile: search + filter on one row, actions on the next.
 * Desktop: search + filter start-aligned, actions end-aligned.
 */
export function DataTableToolbar({
  search,
  filter,
  actions,
  children,
  className,
}: DataTableToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {search}
          {filter}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
