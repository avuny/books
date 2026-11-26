import { Badge } from "@workspace/ui/components/badge"
import type { PartyType } from "../types.js"

export interface PartyTypeBadgeProps {
  partyType: PartyType
  label: string
}

export function PartyTypeBadge({ partyType, label }: PartyTypeBadgeProps) {
  return (
    <Badge variant={partyType === "ORGANIZATION" ? "secondary" : "outline"}>
      {label}
    </Badge>
  )
}
