"use client"

import * as React from "react"
import { MoreVertical } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import type { RowAction } from "./data-table-types"

export interface DataTableRowActionsProps {
  actions: RowAction[]
  /** aria-label of the "⋮" button, e.g. "Actions for INV-001". */
  triggerLabel: string
  /** Optional small heading inside the menu. */
  menuLabel?: string
}

export function DataTableRowActions({
  actions,
  triggerLabel,
  menuLabel,
}: DataTableRowActionsProps) {
  if (actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[popup-open]:bg-muted"
            aria-label={triggerLabel}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        {menuLabel ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
          </DropdownMenuGroup>
        ) : null}
        {actions.map((action) => (
          <React.Fragment key={action.id}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={action.variant}
              disabled={action.disabled}
              onClick={action.onSelect}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
