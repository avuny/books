"use client"

import type { ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export interface DataTableBulkBarProps {
  /** e.g. t("bulk.selected", { count }) -> "3 selected" */
  selectedLabel: string
  clearLabel: string
  onClear: () => void
  /** Bulk action buttons (delete, export selected ...). */
  children?: ReactNode
  className?: string
}

/** Render this only when at least one row is selected. */
export function DataTableBulkBar({
  selectedLabel,
  clearLabel,
  onClear,
  children,
  className,
}: DataTableBulkBarProps) {
  return (
    <div
      role="region"
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2",
        className
      )}
    >
      <span className="text-sm font-medium text-foreground">
        {selectedLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      </div>
    </div>
  )
}
