import { useTranslation } from "react-i18next"
import { INVENTORY_VALUATION_METHODS } from "@avuny/contracts"

import type { ItemFormCopy, ValuationOption } from "./item-form-types"

/** Builds the localized strings for the create or update form. */
export function useItemFormCopy(mode: "create" | "update"): ItemFormCopy {
  const { t } = useTranslation("item")

  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: { label: t("fields.name.label"), placeholder: t("fields.name.placeholder") },
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
