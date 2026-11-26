import { Badge } from "@workspace/ui/components/badge"
import type { OrgMemberType } from "@avuny/contracts"

const VARIANTS = {
  owner: "default",
  managed: "secondary",
  portal: "outline",
} as const satisfies Record<
  OrgMemberType,
  "default" | "secondary" | "outline" | "destructive"
>

export interface MemberTypeBadgeProps {
  type: OrgMemberType
  /** Already-translated label. */
  label: string
}

export function MemberTypeBadge({ type, label }: MemberTypeBadgeProps) {
  return <Badge variant={VARIANTS[type]}>{label}</Badge>
}
