"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

export interface MenuButtonOption {
  id: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
}

export interface DataTableMenuButtonProps {
  /** e.g. "Export" / "Import". On phones only the icon + chevron are shown. */
  label: string
  icon?: ReactNode
  options: MenuButtonOption[]
  disabled?: boolean
  className?: string
}

/** Generic "button with a dropdown" for Export (CSV, XLSX) and Import (CSV, template). */
export function DataTableMenuButton({
  label,
  icon,
  options,
  disabled,
  className,
}: DataTableMenuButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label}
            className={cn("gap-2", className)}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            disabled={option.disabled}
            onClick={option.onSelect}
          >
            {option.icon}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
