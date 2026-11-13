import { Badge } from "@workspace/ui/components/badge"

export type LocationStatusBadgesCopy = {
  inactive: string
  blocked: string
  inheritedBlock: string
}

export interface LocationStatusBadgesProps {
  isActive: boolean
  /** The location's own block. */
  isBlocked: boolean
  /** Own or inherited; omit where it is not known (the tree only knows the own flag). */
  effectiveIsBlocked?: boolean
  copy: LocationStatusBadgesCopy
}

/** Inactive / blocked / blocked-by-a-parent badges. Renders nothing for a healthy location. */
export function LocationStatusBadges({ isActive, isBlocked, effectiveIsBlocked, copy }: LocationStatusBadgesProps) {
  const inherited = !isBlocked && effectiveIsBlocked === true
  if (isActive && !isBlocked && !inherited) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!isActive ? <Badge variant="outline">{copy.inactive}</Badge> : null}
      {isBlocked ? <Badge variant="destructive">{copy.blocked}</Badge> : null}
      {inherited ? <Badge variant="outline">{copy.inheritedBlock}</Badge> : null}
    </div>
  )
}

export type LocationCapabilityBadgesCopy = {
  stockable: string
  pickable: string
  receivable: string
}

export interface LocationCapabilityBadgesProps {
  isStockable: boolean
  isPickable: boolean
  isReceivable: boolean
  copy: LocationCapabilityBadgesCopy
}

export function LocationCapabilityBadges({ isStockable, isPickable, isReceivable, copy }: LocationCapabilityBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isStockable ? <Badge variant="secondary">{copy.stockable}</Badge> : null}
      {isPickable ? <Badge variant="outline">{copy.pickable}</Badge> : null}
      {isReceivable ? <Badge variant="outline">{copy.receivable}</Badge> : null}
    </div>
  )
}
