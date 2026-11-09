import { Badge } from "@workspace/ui/components/badge"

export interface ItemTrackingBadgesProps {
  isInventoryTracked: boolean
  isBatchTracked: boolean
  /** Already-translated labels. */
  trackedLabel: string
  untrackedLabel: string
  batchLabel: string
}

/** How an item's stock is tracked: not at all, by quantity, or by quantity and batch. */
export function ItemTrackingBadges({
  isInventoryTracked,
  isBatchTracked,
  trackedLabel,
  untrackedLabel,
  batchLabel,
}: ItemTrackingBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={isInventoryTracked ? "secondary" : "outline"}>
        {isInventoryTracked ? trackedLabel : untrackedLabel}
      </Badge>
      {isBatchTracked ? <Badge variant="secondary">{batchLabel}</Badge> : null}
    </div>
  )
}
