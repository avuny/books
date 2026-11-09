import { useTranslation } from "react-i18next"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { UnitCollectionButton } from "../forms"
import { trimDecimal } from "../lib"
import { useUnitAbilities, useUnitCollection } from "../unit-api"
import { UnitCollectionDetailsView } from "./unit-collection-details-view"

type UnitCollectionDetailsProps = {
  orgId: string
  collectionId: string
  /** The route decides where "Back" goes. */
  onBack?: () => void
}

// Composition only: strings + API behavior wired into the pure view.
export function UnitCollectionDetails({ orgId, collectionId, onBack }: UnitCollectionDetailsProps) {
  const { t, i18n } = useTranslation("unit")
  const { collection, isLoading, error } = useUnitCollection(orgId, collectionId)
  const abilities = useUnitAbilities(orgId)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso))

  const baseUnit = collection?.units.find((unit) => unit.isBase)

  return (
    <UnitCollectionDetailsView
      collection={collection}
      isLoading={isLoading}
      errorMessage={error ? parseApiError(error).message : null}
      copy={{
        backLabel: t("details.back"),
        baseLabel: t("labels.base"),
        itemsLabel: t("details.items"),
        createdLabel: t("details.createdAt"),
        updatedLabel: t("details.updatedAt"),
        unitsTitle: t("details.unitsTitle"),
        unitHeader: t("details.unit"),
        symbolHeader: t("details.symbol"),
        typeHeader: t("details.type"),
        factorHeader: t("details.factor"),
        inUseHint: t("details.inUseHint"),
      }}
      getTypeLabel={(type) => t(`type.${type}`, { defaultValue: type })}
      getConversionLabel={(unit) =>
        unit.isBase || !baseUnit
          ? ""
          : t("details.conversion", {
              unit: unit.symbol,
              factor: trimDecimal(unit.conversionFactor),
              base: baseUnit.symbol,
            })
      }
      createdAt={collection ? formatDate(collection.createdAt) : ""}
      updatedAt={collection ? formatDate(collection.updatedAt) : ""}
      onBack={onBack}
      editAction={
        abilities.canUpdate && collection ? (
          <UnitCollectionButton orgId={orgId} collectionId={collectionId} />
        ) : undefined
      }
    />
  )
}
