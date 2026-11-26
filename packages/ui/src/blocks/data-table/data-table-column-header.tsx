"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  /** Already-translated title. */
  title: string
  className?: string
}

/** Sortable header: click cycles asc -> desc -> none. */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>
  }

  const sorted = column.getIsSorted()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ms-2.5 h-8 gap-1.5 px-2.5 text-xs font-medium",
        className
      )}
      onClick={column.getToggleSortingHandler()}
    >
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" aria-hidden />
      ) : (
        <ChevronsUpDown
          className="size-3.5 text-muted-foreground"
          aria-hidden
        />
      )}
    </Button>
  )
}
