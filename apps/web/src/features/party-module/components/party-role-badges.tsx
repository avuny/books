import { Badge } from "@workspace/ui/components/badge"
import type { PartyRole } from "../types.js"

export interface PartyRoleBadgeCopy {
  roleLabels: Record<PartyRole, string>
  inactiveLabel: string
}

export interface PartyRoleBadgesProps {
  roles: { role: PartyRole; isActive: boolean }[]
  copy: PartyRoleBadgeCopy
}

export function PartyRoleBadges({ roles, copy }: PartyRoleBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.map((r) => {
        const base = copy.roleLabels[r.role] || r.role
        const text = r.isActive ? base : `${base} (${copy.inactiveLabel})`
        return (
          <Badge
            key={r.role}
            variant={r.isActive ? "default" : "secondary"}
            className={!r.isActive ? "opacity-70" : undefined}
          >
            {text}
          </Badge>
        )
      })}
    </div>
  )
}
