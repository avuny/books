import { Badge } from "@workspace/ui/components/badge"
import { Kbd } from "@workspace/ui/components/kbd"
import { cn } from "@workspace/ui/lib/utils"

import { formatBadgeText } from "./nav-utils.js"
import type { NavBadgeData, NavBadgeVariant } from "./types.js"

const dotTone: Record<NavBadgeVariant, string> = {
  default: "bg-primary",
  secondary: "bg-muted-foreground",
  destructive: "bg-destructive",
}

export type NavBadgeProps = {
  badge: NavBadgeData
  className?: string
}

/** Count, text or dot badge. Counts stay left-to-right so "99+" never flips in RTL. */
export function NavBadge({ badge, className }: NavBadgeProps) {
  const variant = badge.variant ?? "default"

  if (badge.dot) {
    return (
      <>
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            dotTone[variant],
            className
          )}
        />
        {badge.label ? <span className="sr-only">{badge.label}</span> : null}
      </>
    )
  }

  const text = formatBadgeText(badge)
  if (text === null) return null

  return (
    <Badge
      variant={variant}
      dir={badge.text ? undefined : "ltr"}
      className={cn(
        "h-5 min-w-5 justify-center px-1.5 tabular-nums",
        className
      )}
    >
      {text}
    </Badge>
  )
}

export type NavTrailingProps = {
  shortcut?: string
  badge?: NavBadgeData
}

/** End-aligned cluster of an item: keyboard hint plus badge. */
export function NavTrailing({ shortcut, badge }: NavTrailingProps) {
  if (!shortcut && !badge) return null

  return (
    <span className="ms-auto flex shrink-0 items-center gap-1.5">
      {shortcut ? <Kbd dir="ltr">{shortcut}</Kbd> : null}
      {badge ? <NavBadge badge={badge} /> : null}
    </span>
  )
}
