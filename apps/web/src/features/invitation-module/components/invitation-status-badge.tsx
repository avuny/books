import { Badge } from "@workspace/ui/components/badge"

import type { InvitationStatus } from "../types"

const VARIANTS = {
  pending: "secondary",
  accepted: "default",
  declined: "outline",
  revoked: "destructive",
  expired: "outline",
} as const satisfies Record<
  InvitationStatus,
  "default" | "secondary" | "outline" | "destructive"
>

export interface InvitationStatusBadgeProps {
  status: InvitationStatus
  /** Already-translated label. */
  label: string
}

export function InvitationStatusBadge({
  status,
  label,
}: InvitationStatusBadgeProps) {
  return <Badge variant={VARIANTS[status]}>{label}</Badge>
}
