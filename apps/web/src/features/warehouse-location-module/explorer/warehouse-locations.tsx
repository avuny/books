import { useCallback, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useLocationActions, type LocationActionTarget } from "../actions"
import { BulkGenerateButton, LocationButton } from "../forms"
import { LocationList } from "../list"
import { LocationTree } from "../tree"
import type { LocationView } from "../types"
import { useLocationWarehouse } from "../warehouse-location-api"

const VIEWS: readonly LocationView[] = ["table", "tree"]

type WarehouseLocationsProps = {
  orgId: string
  warehouseId: string
  /** The route decides how to navigate to the location page. */
  onViewLocation: (locationId: string) => void
  /** The route decides where "Back" goes (the warehouse page). */
  onBack?: () => void
}

// Composition only: one warehouse's locations as a table or a lazy tree, sharing one set of row actions.
export function WarehouseLocations({ orgId, warehouseId, onViewLocation, onBack }: WarehouseLocationsProps) {
  const { t } = useTranslation("warehouse-location")
  const [view, setView] = useState<LocationView>("table")
  const { warehouse, isLoading } = useLocationWarehouse(orgId, warehouseId)
  const { abilities, readOnly, getActions, dialogs, actionError, clearActionError } = useLocationActions(orgId, warehouse)

  const actionsFor = useCallback(
    (location: LocationActionTarget) => getActions(location, { onView: () => onViewLocation(location.id) }),
    [getActions, onViewLocation]
  )

  const canCreate = abilities.canCreate && !readOnly && warehouse !== null

  return (
    <div className="flex flex-col gap-4">
      {onBack ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t("list.back")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{t("list.title")}</h1>
          {isLoading ? (
            <Skeleton className="mt-1 h-4 w-48" aria-busy />
          ) : (
            <p className="text-sm text-muted-foreground">
              {warehouse ? `${warehouse.name} (${warehouse.code}) · ` : ""}
              {t("list.description")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("list.view.aria")} className="flex items-center gap-1">
            {VIEWS.map((item) => (
              <Button key={item} type="button" size="sm" variant={view === item ? "default" : "outline"} aria-pressed={view === item} onClick={() => setView(item)}>
                {t(`list.view.${item}`)}
              </Button>
            ))}
          </div>
          {canCreate && warehouse ? (
            <>
              <BulkGenerateButton orgId={orgId} warehouse={warehouse} />
              <LocationButton orgId={orgId} warehouse={warehouse} />
            </>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive" onClick={clearActionError}>
          {actionError}
        </p>
      ) : null}

      {view === "table" ? (
        <LocationList orgId={orgId} warehouseId={warehouseId} getActions={actionsFor} onViewLocation={onViewLocation} />
      ) : (
        <LocationTree orgId={orgId} warehouseId={warehouseId} getActions={actionsFor} onViewLocation={onViewLocation} />
      )}

      {dialogs}
    </div>
  )
}
