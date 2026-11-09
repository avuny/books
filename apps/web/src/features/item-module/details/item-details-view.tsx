import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ItemStatusBadge, ItemTrackingBadges } from "../components"
import type { ItemDto } from "../types"

export type ItemDetailsViewCopy = {
  backLabel: string
  activeLabel: string
  inactiveLabel: string
  trackedLabel: string
  untrackedLabel: string
  batchLabel: string
  categoryLabel: string
  baseUnitLabel: string
  valuationLabel: string
  reorderPointLabel: string
  negativeStockLabel: string
  settingsTitle: string
  flagsTitle: string
  assemblableLabel: string
  returnableLabel: string
  createdLabel: string
  updatedLabel: string
  /** Shown when no reorder point is set. */
  noneLabel: string
  /** "Allowed" / "Not allowed" */
  allowedLabel: string
  notAllowedLabel: string
}

export interface ItemDetailsViewProps {
  item: ItemDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the item when loading failed. */
  errorMessage?: string | null
  copy: ItemDetailsViewCopy
  /** Already localized: "Kilogram (kg)". */
  baseUnitText: string
  /** Already localized: "First in, first out (FIFO)". */
  valuationText: string
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually <ItemButton />; omit when the user can't edit. */
  editAction?: ReactNode
}

export function ItemDetailsView({
  item,
  isLoading,
  errorMessage,
  copy,
  baseUnitText,
  valuationText,
  createdAt,
  updatedAt,
  onBack,
  editAction,
}: ItemDetailsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {onBack ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {copy.backLabel}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4" aria-busy>
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !item ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{item.name}</h1>
                <ItemStatusBadge
                  isActive={item.isActive}
                  activeLabel={copy.activeLabel}
                  inactiveLabel={copy.inactiveLabel}
                />
              </div>
              {item.description ? (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            {editAction}
          </div>

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{copy.categoryLabel}</dt>
              <dd className="text-foreground">{item.categoryName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.baseUnitLabel}</dt>
              <dd className="text-foreground">{baseUnitText}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.createdLabel}</dt>
              <dd className="text-foreground">{createdAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.updatedLabel}</dt>
              <dd className="text-foreground">{updatedAt}</dd>
            </div>
          </dl>

          <section className="grid gap-3">
            <h2 className="text-sm font-medium text-foreground">{copy.settingsTitle}</h2>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{copy.valuationLabel}</dt>
                <dd className="text-foreground">{valuationText}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{copy.reorderPointLabel}</dt>
                <dd className="text-foreground tabular-nums">
                  {item.reorderPoint ?? copy.noneLabel}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{copy.negativeStockLabel}</dt>
                <dd className="text-foreground">
                  {item.allowNegativeStock ? copy.allowedLabel : copy.notAllowedLabel}
                </dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-2">
            <h2 className="text-sm font-medium text-foreground">{copy.flagsTitle}</h2>
            <div className="flex flex-wrap gap-2">
              <ItemTrackingBadges
                isInventoryTracked={item.isInventoryTracked}
                isBatchTracked={item.isBatchTracked}
                trackedLabel={copy.trackedLabel}
                untrackedLabel={copy.untrackedLabel}
                batchLabel={copy.batchLabel}
              />
              {item.canAssembled ? <Badge variant="outline">{copy.assemblableLabel}</Badge> : null}
              {item.isReturnable ? <Badge variant="outline">{copy.returnableLabel}</Badge> : null}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
