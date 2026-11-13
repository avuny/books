import { useTranslation } from "react-i18next"
import { DataTableRowActions } from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useLocationActions } from "../actions"
import { LocationButton } from "../forms"
import { getLocationActionAvailability, useWarehouseLocationLabels } from "../lib"
import { useLocation, useLocationWarehouse } from "../warehouse-location-api"
import { LocationDetailsView } from "./location-details-view"

type LocationDetailsProps = {
  orgId: string
  warehouseId: string
  locationId: string
  /** The route decides where "Back" goes (also used after a delete). */
  onBack?: () => void
  /** The route decides how to navigate to an ancestor. */
  onViewLocation?: (locationId: string) => void
}

// Composition only: strings + API behavior wired into the pure view.
export function LocationDetails({ orgId, warehouseId, locationId, onBack, onViewLocation }: LocationDetailsProps) {
  const { t, i18n } = useTranslation("warehouse-location")
  const { location, isLoading, error } = useLocation(orgId, locationId)
  const { warehouse } = useLocationWarehouse(orgId, warehouseId)
  const { getTypeLabel, getPurposeLabel } = useWarehouseLocationLabels()
  const { abilities, readOnly, getActions, dialogs, actionError } = useLocationActions(orgId, warehouse, {
    onDeleted: () => onBack?.(),
  })

  const formatDate = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso))

  const availability = location ? getLocationActionAvailability(location, abilities, readOnly) : null
  const menu = location ? getActions(location, { includeEdit: false }) : []

  return (
    <>
      <LocationDetailsView
        location={location}
        isLoading={isLoading}
        errorMessage={error ? parseApiError(error).message : null}
        actionError={actionError}
        copy={{
          backLabel: t("details.back"),
          fullCodeLabel: t("details.fullCode"),
          nameLabel: t("details.name"),
          typeLabel: t("details.type"),
          purposeLabel: t("details.purpose"),
          barcodeLabel: t("details.barcode"),
          warehouseLabel: t("details.warehouse"),
          pathAria: t("details.pathAria"),
          capabilitiesLabel: t("details.capabilities"),
          measuresLabel: t("details.measures"),
          blockedReasonLabel: t("details.blockedReason"),
          createdLabel: t("details.createdAt"),
          updatedLabel: t("details.updatedAt"),
          measureLabels: {
            width: t("fields.measures.width"),
            height: t("fields.measures.height"),
            depth: t("fields.measures.depth"),
            maxWeight: t("fields.measures.maxWeight"),
            maxVolume: t("fields.measures.maxVolume"),
          },
          none: t("details.none"),
          noBarcode: t("details.noBarcode"),
          typeValue: location ? getTypeLabel(location.type) : "",
          purposeValue: location ? getPurposeLabel(location.purpose) : "",
          badges: { inactive: t("badges.inactive"), blocked: t("badges.blocked"), inheritedBlock: t("badges.inheritedBlock") },
          capabilities: { stockable: t("badges.stockable"), pickable: t("badges.pickable"), receivable: t("badges.receivable") },
        }}
        createdAt={location ? formatDate(location.createdAt) : ""}
        updatedAt={location ? formatDate(location.updatedAt) : ""}
        onBack={onBack}
        onSelectPathItem={onViewLocation}
        actions={
          location && warehouse ? (
            <>
              {availability?.canEdit ? <LocationButton orgId={orgId} warehouse={warehouse} locationId={locationId} /> : null}
              {menu.length > 0 ? <DataTableRowActions actions={menu} triggerLabel={t("actions.more")} /> : null}
            </>
          ) : undefined
        }
      />
      {dialogs}
    </>
  )
}
