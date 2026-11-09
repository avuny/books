import { useTranslation } from "react-i18next"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { unitLabel } from "../../unit-module"
import { ItemButton } from "../forms"
import { useItem, useItemAbilities } from "../item-api"
import { ItemDetailsView } from "./item-details-view"

type ItemDetailsProps = {
  orgId: string
  itemId: string
  /** The route decides where "Back" goes. */
  onBack?: () => void
}

// Composition only: strings + API behavior wired into the pure view.
export function ItemDetails({ orgId, itemId, onBack }: ItemDetailsProps) {
  const { t, i18n } = useTranslation("item")
  const { item, isLoading, error } = useItem(orgId, itemId)
  const abilities = useItemAbilities(orgId)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso))

  return (
    <ItemDetailsView
      item={item}
      isLoading={isLoading}
      errorMessage={error ? parseApiError(error).message : null}
      copy={{
        backLabel: t("details.back"),
        activeLabel: t("type.active"),
        inactiveLabel: t("type.inactive"),
        trackedLabel: t("type.tracked"),
        untrackedLabel: t("type.untracked"),
        batchLabel: t("type.batch"),
        categoryLabel: t("details.category"),
        baseUnitLabel: t("details.baseUnit"),
        valuationLabel: t("details.valuation"),
        reorderPointLabel: t("details.reorderPoint"),
        negativeStockLabel: t("details.allowNegativeStock"),
        settingsTitle: t("details.settingsTitle"),
        flagsTitle: t("details.flagsTitle"),
        assemblableLabel: t("details.assemblable"),
        returnableLabel: t("details.returnable"),
        createdLabel: t("details.createdAt"),
        updatedLabel: t("details.updatedAt"),
        noneLabel: t("details.none"),
        allowedLabel: t("details.yes"),
        notAllowedLabel: t("details.no"),
      }}
      baseUnitText={item ? unitLabel(item.baseUnit) : ""}
      valuationText={item ? t(`labels.valuation.${item.inventoryValuationMethod}`) : ""}
      createdAt={item ? formatDate(item.createdAt) : ""}
      updatedAt={item ? formatDate(item.updatedAt) : ""}
      onBack={onBack}
      editAction={
        abilities.canUpdate && item ? <ItemButton orgId={orgId} itemId={itemId} /> : undefined
      }
    />
  )
}
