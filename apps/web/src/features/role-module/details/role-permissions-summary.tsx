import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import type { StatementGroup } from "../lib"

export type RolePermissionsSummaryCopy = {
  /** Shown when the role has no statements. */
  empty: string
  /** Prefix for deny statements, e.g. "Deny". */
  denyLabel: string
}

export interface RolePermissionsSummaryProps {
  groups: StatementGroup[]
  copy: RolePermissionsSummaryCopy
  /** Already-localized names; wildcards are resolved by the caller. */
  getResourceLabel: (resource: string) => string
  getActionLabel: (action: string) => string
  className?: string
}

/** Read-only view of a role's statements, grouped by resource. */
export function RolePermissionsSummary({
  groups,
  copy,
  getResourceLabel,
  getActionLabel,
  className,
}: RolePermissionsSummaryProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {copy.empty}
      </p>
    )
  }

  return (
    <ul className={cn("grid gap-3", className)}>
      {groups.map((group) => (
        <li
          key={group.resource}
          className="rounded-lg border border-border bg-card p-3 text-card-foreground"
        >
          <p className="text-sm font-medium text-foreground">
            {getResourceLabel(group.resource)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.entries.map((entry) => (
              <Badge
                key={entry.id}
                variant={entry.effect === "deny" ? "destructive" : "secondary"}
              >
                {entry.effect === "deny" ? `${copy.denyLabel}: ` : ""}
                {getActionLabel(entry.action)}
                {entry.resourceId !== "*" ? ` · ${entry.resourceId}` : ""}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
