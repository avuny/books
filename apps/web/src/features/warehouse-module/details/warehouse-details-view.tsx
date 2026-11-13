import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { WarehouseBadges, type WarehouseBadgesCopy } from "../components"
import type { WarehouseDto } from "../types"

export type WarehouseDetailsViewCopy = {
  backLabel: string
  codeLabel: string
  typeLabel: string
  statusLabel: string
  descriptionLabel: string
  addressLabel: string
  createdLabel: string
  updatedLabel: string
  /** Shown when an optional value is empty. */
  none: string
  /** Already-translated type of THIS warehouse. */
  typeValue: string
  /** Already-translated "Active" / "Inactive" of THIS warehouse. */
  statusValue: string
  badges: Omit<WarehouseBadgesCopy, "type">
}

export interface WarehouseDetailsViewProps {
  warehouse: WarehouseDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the warehouse when loading failed. */
  errorMessage?: string | null
  /** Already localized message of a failed menu action (set default, reactivate). */
  actionError?: string | null
  copy: WarehouseDetailsViewCopy
  /** Already formatted. */
  address: string
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually the edit button and the actions menu; omit when the user can do nothing. */
  actions?: ReactNode
  /** Link to the warehouse's location management. */
  locationsAction?: ReactNode
}

export function WarehouseDetailsView({
  warehouse,
  isLoading,
  errorMessage,
  actionError,
  copy,
  address,
  createdAt,
  updatedAt,
  onBack,
  actions,
  locationsAction,
}: WarehouseDetailsViewProps) {
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
      ) : !warehouse ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{warehouse.name}</h1>
                <WarehouseBadges warehouse={warehouse} copy={{ ...copy.badges, type: "" }} />
              </div>
              <p className="font-mono text-sm text-muted-foreground">{warehouse.code}</p>
            </div>
            <div className="flex items-center gap-2">
              {locationsAction}
              {actions}
            </div>
          </div>

          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{copy.codeLabel}</dt>
              <dd className="font-mono text-foreground">{warehouse.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.typeLabel}</dt>
              <dd className="text-foreground">{copy.typeValue}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.statusLabel}</dt>
              <dd className="text-foreground">{copy.statusValue}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.descriptionLabel}</dt>
              <dd className="text-foreground">{warehouse.description ?? copy.none}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{copy.addressLabel}</dt>
              <dd className="text-foreground">{address || copy.none}</dd>
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
        </>
      )}
    </div>
  )
}
