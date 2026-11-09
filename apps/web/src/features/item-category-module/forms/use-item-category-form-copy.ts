import { useTranslation } from "react-i18next"

import { useAsyncComboboxCopy } from "../../lib/options/use-async-combobox-copy"
import { useItemCategoryOptions } from "../item-category-api"
import type { ItemCategoryFormCopy, ItemCategoryParentPicker } from "./item-category-form-types"

/** Builds the localized strings for the create or update form. */
export function useItemCategoryFormCopy(mode: "create" | "update"): ItemCategoryFormCopy {
  const { t } = useTranslation("item-category")

  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: {
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
    },
    categoryDescription: {
      label: t("fields.description.label"),
      placeholder: t("fields.description.placeholder"),
    },
    parent: {
      label: t("fields.parent.label"),
      placeholder: t("fields.parent.placeholder"),
    },
    isActive: {
      label: t("fields.isActive.label"),
      description: t("fields.isActive.description"),
    },
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}

/** Async combobox pieces for the parent picker (lazy: nothing is fetched until it opens). */
export function useItemCategoryParentPicker(
  orgId: string,
  initialOption?: { id: string; name: string } | null
): ItemCategoryParentPicker {
  return {
    copy: useAsyncComboboxCopy(),
    source: useItemCategoryOptions(orgId),
    initialOption,
  }
}
