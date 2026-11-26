import { Badge } from "@workspace/ui/components/badge"
import type { PartyPhoneDto } from "../types.js"

export interface PartyPhonesProps {
  phones: PartyPhoneDto[]
  primaryLabel: string
}

export function PartyPhones({ phones, primaryLabel }: PartyPhonesProps) {
  if (phones.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  return (
    <ul className="space-y-1 text-sm">
      {phones.map((p) => (
        <li key={p.id} className="flex items-center gap-2">
          <span dir="ltr">{p.phone}</span>
          {p.label ? (
            <span className="text-muted-foreground text-xs">({p.label})</span>
          ) : null}
          {p.isPrimary ? (
            <Badge variant="outline" className="text-xs">
              {primaryLabel}
            </Badge>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
