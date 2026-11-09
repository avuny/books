import { useTranslation } from "react-i18next"

import { useAsyncComboboxCopy } from "../../lib/options/use-async-combobox-copy"
import { useUnitOptions } from "../unit-api"
import type { UnitCollectionFormCopy, UnitPicker } from "./unit-collection-form-types"

/** Builds the localized strings for the create or update form. */
export function useUnitCollectionFormCopy(mode: "create" | "update"): UnitCollectionFormCopy {
  const { t } = useTranslation("unit")

  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: {
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
    },
    baseUnit: {
      label: t("fields.baseUnit.label"),
      placeholder: t("fields.baseUnit.placeholder"),
    },
    baseUnitLocked: t("fields.baseUnit.locked"),
    extraUnits: {
      label: t("fields.extraUnits.label"),
      description: t("fields.extraUnits.description"),
      empty: t("fields.extraUnits.empty"),
      add: t("fields.extraUnits.add"),
      remove: t("fields.extraUnits.remove"),
      pickBaseFirst: t("fields.extraUnits.pickBaseFirst"),
      unit: {
        label: t("fields.unit.label"),
        placeholder: t("fields.unit.placeholder"),
      },
      conversionFactor: {
        label: t("fields.conversionFactor.label"),
        placeholder: t("fields.conversionFactor.placeholder"),
        description: t("fields.conversionFactor.description"),
      },
    },
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}

/** Async combobox pieces for a unit picker; `sameTypeAs` narrows it to one unit type. */
export function useUnitPicker(orgId: string, filter: { sameTypeAs?: string } = {}): UnitPicker {
  return {
    copy: useAsyncComboboxCopy(),
    source: useUnitOptions(orgId, filter),
  }
}
