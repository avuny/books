import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  LocationCapabilityBadges,
  LocationStatusBadges,
  type LocationCapabilityBadgesCopy,
  type LocationStatusBadgesCopy,
} from "../components"
import type { WarehouseLocationDetailDto } from "../types"

export type LocationDetailsViewCopy = {
  backLabel: string
  fullCodeLabel: string
  nameLabel: string
  typeLabel: string
  purposeLabel: string
  barcodeLabel: string
  warehouseLabel: string
  pathAria: string
  capabilitiesLabel: string
  measuresLabel: string
  blockedReasonLabel: string
  createdLabel: string
  updatedLabel: string
  measureLabels: { width: string; height: string; depth: string; maxWeight: string; maxVolume: string }
  /** Shown when an optional value is empty. */
  none: string
  noBarcode: string
  /** Already-translated values for THIS location. */
  typeValue: string
  purposeValue: string
  badges: LocationStatusBadgesCopy
  capabilities: LocationCapabilityBadgesCopy
}

export interface LocationDetailsViewProps {
  location: WarehouseLocationDetailDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the location when loading failed. */
  errorMessage?: string | null
  /** Already localized message of a failed menu action (unblock, reactivate). */
  actionError?: string | null
  copy: LocationDetailsViewCopy
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Click on an ancestor in the path. */
  onSelectPathItem?: (locationId: string) => void
  /** Usually the edit / add-child buttons and the actions menu. */
  actions?: ReactNode
}

export function LocationDetailsView({
  location,
  isLoading,
  errorMessage,
  actionError,
  copy,
  createdAt,
  updatedAt,
  onBack,
  onSelectPathItem,
  actions,
}: LocationDetailsViewProps) {
  const measures = location
    ? ([
        ["width", location.width],
        ["height", location.height],
        ["depth", location.depth],
        ["maxWeight", location.maxWeight],
        ["maxVolume", location.maxVolume],
      ] as const).filter(([, value]) => value !== null)
    : []

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
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !location ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{location.name}</h1>
                <LocationStatusBadges
                  isActive={location.isActive}
                  isBlocked={location.isBlocked}
                  effectiveIsBlocked={location.effectiveIsBlocked}
                  copy={copy.badges}
                />
              </div>
              <nav aria-label={copy.pathAria} className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                <span>{location.warehouse.code}</span>
                {location.path.map((item) => (
                  <span key={item.id} className="flex items-center gap-1">
                    <span aria-hidden>/</span>
                    {item.id !== location.id && onSelectPathItem ? (
                      <button type="button" className="font-mono underline-offset-2 hover:underline" onClick={() => onSelectPathItem(item.id)}>
                        {item.code}
                      </button>
                    ) : (
                      <span className="font-mono text-foreground">{item.code}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          </div>

          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{copy.fullCodeLabel}</dt>
              <dd className="font-mono text-foreground">{location.fullCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.warehouseLabel}</dt>
              <dd className="text-foreground">{location.warehouse.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.typeLabel}</dt>
              <dd className="text-foreground">{copy.typeValue}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.purposeLabel}</dt>
              <dd className="text-foreground">{copy.purposeValue}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.barcodeLabel}</dt>
              <dd className="font-mono text-foreground">{location.barcode ?? copy.noBarcode}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.capabilitiesLabel}</dt>
              <dd>
                <LocationCapabilityBadges
                  isStockable={location.isStockable}
                  isPickable={location.isPickable}
                  isReceivable={location.isReceivable}
                  copy={copy.capabilities}
                />
              </dd>
            </div>
            {location.isBlocked ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{copy.blockedReasonLabel}</dt>
                <dd className="text-foreground">{location.blockedReason ?? copy.none}</dd>
              </div>
            ) : null}
            {measures.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{copy.measuresLabel}</dt>
                <dd className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums text-foreground sm:grid-cols-3">
                  {measures.map(([key, value]) => (
                    <span key={key}>
                      <span className="text-muted-foreground">{copy.measureLabels[key]}: </span>
                      {value}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-muted-foreground">{copy.createdLabel}</dt>
              <dd className="text-foreground">{createdAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.updatedLabel}</dt>
              <dd className="text-foreground">{updatedAt}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  )
}
