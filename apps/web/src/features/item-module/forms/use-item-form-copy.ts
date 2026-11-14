import { useTranslation } from "react-i18next"
import { INVENTORY_VALUATION_METHODS, SHELF_LIFE_UNITS } from "@avuny/contracts"

import type { ItemFormCopy, ShelfLifeUnitOption, ValuationOption } from "./item-form-types"

/** Builds the localized strings for the create or update form. */
export function useItemFormCopy(mode: "create" | "update"): ItemFormCopy {
  const { t } = useTranslation("item")

  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: {
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
    },
    itemDescription: {
      label: t("fields.description.label"),
      placeholder: t("fields.description.placeholder"),
    },
    category: {
      label: t("fields.category.label"),
      placeholder: t("fields.category.placeholder"),
    },
    baseUnit: {
      label: t("fields.baseUnit.label"),
      placeholder: t("fields.baseUnit.placeholder"),
      description: t("fields.baseUnit.description"),
    },
    unitCollection: {
      label: t("fields.unitCollection.label"),
      placeholder: t("fields.unitCollection.placeholder"),
      description: t("fields.unitCollection.description"),
    },
    unitExclusive: t("fields.unitExclusive"),
    canAssembled: { label: t("fields.canAssembled.label") },
    isReturnable: { label: t("fields.isReturnable.label") },
    isInventoryTracked: { label: t("fields.isInventoryTracked.label") },
    isBatchTracked: {
      label: t("fields.isBatchTracked.label"),
      description: t("fields.isBatchTracked.description"),
    },
    isExpiryTracked: {
      label: t("fields.isExpiryTracked.label"),
      description: t("fields.isExpiryTracked.description"),
    },
    shelfLifeValue: {
      label: t("fields.shelfLifeValue.label"),
      placeholder: t("fields.shelfLifeValue.placeholder"),
    },
    shelfLifeUnit: {
      label: t("fields.shelfLifeUnit.label"),
      placeholder: t("fields.shelfLifeUnit.placeholder"),
    },
    valuationMethod: {
      label: t("fields.valuationMethod.label"),
      placeholder: t("fields.valuationMethod.placeholder"),
    },
    allowNegativeStock: { label: t("fields.allowNegativeStock.label") },
    reorderPoint: {
      label: t("fields.reorderPoint.label"),
      placeholder: t("fields.reorderPoint.placeholder"),
      description: t("fields.reorderPoint.description"),
    },
    isActive: { label: t("fields.isActive.label") },
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
    openingStock: {
      sectionTitle: t("fields.openingStock.sectionTitle"),
      sectionDescription: t("fields.openingStock.sectionDescription"),
      postedAt: {
        label: t("fields.openingStock.postedAt.label"),
        placeholder: t("fields.openingStock.postedAt.placeholder"),
        description: t("fields.openingStock.postedAt.description"),
      },
      addLine: t("fields.openingStock.addLine"),
      removeLine: t("fields.openingStock.removeLine"),
      line: {
        location: {
          label: t("fields.openingStock.line.location.label"),
          placeholder: t("fields.openingStock.line.location.placeholder"),
        },
        quantity: {
          label: t("fields.openingStock.line.quantity.label"),
          placeholder: t("fields.openingStock.line.quantity.placeholder"),
        },
      },
      batch: {
        toggle: t("fields.openingStock.batch.toggle"),
        number: {
          label: t("fields.openingStock.batch.number.label"),
          placeholder: t("fields.openingStock.batch.number.placeholder"),
        },
        manufacturedOn: {
          label: t("fields.openingStock.batch.manufacturedOn.label"),
          placeholder: t("fields.openingStock.batch.manufacturedOn.placeholder"),
        },
        expiresOn: {
          label: t("fields.openingStock.batch.expiresOn.label"),
          placeholder: t("fields.openingStock.batch.expiresOn.placeholder"),
        },
      },
    },
  }
}

/** The fixed valuation methods with their localized names. */
export function useValuationOptions(): ValuationOption[] {
  const { t } = useTranslation("item")
  return INVENTORY_VALUATION_METHODS.map((method) => ({
    value: method,
    label: t(`labels.valuation.${method}`),
  }))
}

/** The fixed shelf life units with their localized names. */
export function useShelfLifeUnitOptions(): ShelfLifeUnitOption[] {
  const { t } = useTranslation("item")
  return SHELF_LIFE_UNITS.map((unit) => ({
    value: unit,
    label: t(`labels.shelfLifeUnit.${unit}`),
  }))
}
