import { useTranslation } from "react-i18next"
import { WAREHOUSE_TYPES } from "@avuny/contracts"

import type { WarehouseFormCopy } from "./warehouse-form-types"

export function useWarehouseFormCopy(mode: "create" | "update"): WarehouseFormCopy {
  const { t } = useTranslation("warehouse")
  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    code: {
      label: t("fields.code.label"),
      placeholder: t("fields.code.placeholder"),
    },
    name: {
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
    },
    warehouseDescription: {
      label: t("fields.description.label"),
      placeholder: t("fields.description.placeholder"),
    },
    type: {
      label: t("fields.type.label"),
      placeholder: t("fields.type.placeholder"),
    },
    addressLine: {
      label: t("fields.addressLine.label"),
      placeholder: t("fields.addressLine.placeholder"),
    },
    city: {
      label: t("fields.city.label"),
      placeholder: t("fields.city.placeholder"),
    },
    region: {
      label: t("fields.region.label"),
      placeholder: t("fields.region.placeholder"),
    },
    postalCode: {
      label: t("fields.postalCode.label"),
      placeholder: t("fields.postalCode.placeholder"),
    },
    countryCode: {
      label: t("fields.countryCode.label"),
      placeholder: t("fields.countryCode.placeholder"),
    },
    createDefaultLocation: {
      label: t("fields.createDefaultLocation.label"),
      description: t("fields.createDefaultLocation.description"),
    },
    typeOptions: WAREHOUSE_TYPES.map((value) => ({ value, label: t(`labels.types.${value}`, { defaultValue: value }) })),
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}
