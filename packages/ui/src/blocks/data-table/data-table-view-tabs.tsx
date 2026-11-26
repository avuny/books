"use client"

import { cn } from "@workspace/ui/lib/utils"

export interface ViewTab {
  value: string
  /** Already-translated label. */
  label: string
  count?: number
}

export interface DataTableViewTabsProps {
  tabs: ViewTab[]
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  className?: string
}

/** Status/saved-view tabs ("All, Draft, Paid, Overdue ..."). Scrolls on mobile. */
export function DataTableViewTabs({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  className,
}: DataTableViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 rounded-t-md px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
