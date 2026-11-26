"use client"

import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { isInteractiveTarget } from "./data-table-utils"

export interface MobileCardField {
  label: string
  value: ReactNode
}

export interface DataTableMobileCardProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Usually a status badge, shown top-end. */
  badge?: ReactNode
  fields?: MobileCardField[]
  /** Usually <DataTableRowActions />. */
  actions?: ReactNode
  /** Usually a checkbox. */
  leading?: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}

/** One row of a module rendered as a card on phones. */
export function DataTableMobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  leading,
  selected,
  onClick,
  className,
}: DataTableMobileCardProps) {
  return (
    <div
      data-state={selected ? "selected" : undefined}
      className={cn(
        "flex gap-3 p-4 data-[state=selected]:bg-muted",
        onClick && "cursor-pointer active:bg-muted/60",
        className
      )}
      onClick={
        onClick
          ? (event) => {
              if (isInteractiveTarget(event.target)) return
              onClick()
            }
          : undefined
      }
    >
      {leading ? <div className="pt-0.5">{leading}</div> : null}

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {title}
            </div>
            {subtitle ? (
              <div className="truncate text-xs text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>
          {badge}
        </div>

        {fields && fields.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="truncate text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
