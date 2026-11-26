"use client"

import { X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { ActiveFilter } from "./data-table-types"

export interface DataTableActiveFiltersProps {
  /** Use getActiveFilters(fields, values). */
  filters: ActiveFilter[]
  onRemove: (id: string) => void
  onClearAll: () => void
  clearAllLabel: string
  /** aria-label for each chip's remove button. */
  removeLabel: (filter: ActiveFilter) => string
  className?: string
}

export function DataTableActiveFilters({
  filters,
  onRemove,
  onClearAll,
  clearAllLabel,
  removeLabel,
  className,
}: DataTableActiveFiltersProps) {
  if (filters.length === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 py-0.5 ps-3 pe-1 text-xs"
        >
          <span className="text-muted-foreground">{filter.label}:</span>
          <span className="truncate font-medium text-foreground">
            {filter.valueLabel}
          </span>
          <button
            type="button"
            aria-label={removeLabel(filter)}
            onClick={() => onRemove(filter.id)}
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
        {clearAllLabel}
      </Button>
    </div>
  )
}
