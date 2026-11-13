import { MapPin } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTableRowActions } from "@workspace/ui/blocks/data-table"
import { Button } from "@workspace/ui/components/button"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useWarehouseActions } from "../actions"
import { WarehouseButton } from "../forms"
import { formatAddress, getWarehouseActionAvailability, useWarehouseLabels } from "../lib"
import { useWarehouse } from "../warehouse-api"
import { WarehouseDetailsView } from "./warehouse-details-view"

type WarehouseDetailsProps = {
  orgId: string
  warehouseId: string
  /** The route decides where "Back" goes (also used after a delete). */
  onBack?: () => void
  /** The route decides where the location management lives. */
  onViewLocations?: () => void
}

// Composition only: strings + API behavior wired into the pure view.
export function WarehouseDetails({ orgId, warehouseId, onBack, onViewLocations }: WarehouseDetailsProps) {
  const { t, i18n } = useTranslation("warehouse")
  const { warehouse, isLoading, error } = useWarehouse(orgId, warehouseId)
  const { getTypeLabel } = useWarehouseLabels()
  const { abilities, getActions, dialogs, actionError } = useWarehouseActions(orgId, { onDeleted: () => onBack?.() })

  const formatDate = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso))

  const availability = warehouse ? getWarehouseActionAvailability(warehouse, abilities) : null
  const menu = warehouse ? getActions(warehouse, { includeEdit: false }) : []

  return (
    <>
      <WarehouseDetailsView
        warehouse={warehouse}
        isLoading={isLoading}
        errorMessage={error ? parseApiError(error).message : null}
        actionError={actionError}
        copy={{
          backLabel: t("details.back"),
          codeLabel: t("details.code"),
          typeLabel: t("details.type"),
          statusLabel: t("details.status"),
          descriptionLabel: t("details.description"),
          addressLabel: t("details.address"),
          createdLabel: t("details.createdAt"),
          updatedLabel: t("details.updatedAt"),
          none: t("details.none"),
          typeValue: warehouse ? getTypeLabel(warehouse.type) : "",
          statusValue: warehouse ? t(warehouse.isActive ? "badges.active" : "badges.inactive") : "",
          badges: { default: t("badges.default"), system: t("badges.system"), inactive: t("badges.inactive") },
        }}
        address={warehouse ? formatAddress(warehouse) : ""}
        createdAt={warehouse ? formatDate(warehouse.createdAt) : ""}
        updatedAt={warehouse ? formatDate(warehouse.updatedAt) : ""}
        onBack={onBack}
        locationsAction={
          onViewLocations && warehouse ? (
            <Button type="button" variant="outline" onClick={onViewLocations}>
              <MapPin className="size-4" aria-hidden />
              {t("actions.viewLocations")}
            </Button>
          ) : undefined
        }
        actions={
          warehouse ? (
            <>
              {availability?.canEdit ? <WarehouseButton orgId={orgId} warehouseId={warehouseId} /> : null}
              {menu.length > 0 ? <DataTableRowActions actions={menu} triggerLabel={t("actions.more")} /> : null}
            </>
          ) : undefined
        }
      />
      {dialogs}
    </>
  )
}
