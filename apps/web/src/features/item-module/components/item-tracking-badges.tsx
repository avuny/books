import { Badge } from "@workspace/ui/components/badge"

export interface ItemTrackingBadgesProps {
  isInventoryTracked: boolean
  isBatchTracked: boolean
  isExpiryTracked?: boolean
  /** Already-translated labels. */
  trackedLabel: string
  untrackedLabel: string
  batchLabel: string
  expiryLabel?: string
}

/** How an item's stock is tracked: not at all, by quantity, or by quantity and batch. */
export function ItemTrackingBadges({
  isInventoryTracked,
  isBatchTracked,
  isExpiryTracked = false,
  trackedLabel,
  untrackedLabel,
  batchLabel,
  expiryLabel,
}: ItemTrackingBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={isInventoryTracked ? "secondary" : "outline"}>
        {isInventoryTracked ? trackedLabel : untrackedLabel}
      </Badge>
      {isBatchTracked ? <Badge variant="secondary">{batchLabel}</Badge> : null}
      {isExpiryTracked && expiryLabel ? (
        <Badge variant="secondary">{expiryLabel}</Badge>
      ) : null}
    </div>
  )
}
