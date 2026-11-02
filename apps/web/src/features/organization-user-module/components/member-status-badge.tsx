import { Badge } from "@workspace/ui/components/badge"

import type { MemberStatus } from "../types"

const VARIANTS = {
  active: "default",
  inactive: "outline",
} as const satisfies Record<
  MemberStatus,
  "default" | "secondary" | "outline" | "destructive"
>

export interface MemberStatusBadgeProps {
  status: MemberStatus
  /** Already-translated label. */
  label: string
}

export function MemberStatusBadge({ status, label }: MemberStatusBadgeProps) {
  return <Badge variant={VARIANTS[status]}>{label}</Badge>
}
