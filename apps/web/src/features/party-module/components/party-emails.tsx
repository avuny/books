import { Badge } from "@workspace/ui/components/badge"
import type { PartyEmailDto } from "../types.js"

export interface PartyEmailsProps {
  emails: PartyEmailDto[]
  primaryLabel: string
}

export function PartyEmails({ emails, primaryLabel }: PartyEmailsProps) {
  if (emails.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  return (
    <ul className="space-y-1 text-sm">
      {emails.map((e) => (
        <li key={e.id} className="flex items-center gap-2">
          <span>{e.email}</span>
          {e.label ? (
            <span className="text-muted-foreground text-xs">({e.label})</span>
          ) : null}
          {e.isPrimary ? (
            <Badge variant="outline" className="text-xs">
              {primaryLabel}
            </Badge>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
