import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { UnitFormCopy } from "./unit-form-types"

export function useUnitFormCopy(): UnitFormCopy {
  const { t } = useTranslation("unit")

  return useMemo<UnitFormCopy>(
    () => ({
      fields: {
        name: {
          label: t("fields.name.label"),
          placeholder: t("fields.name.placeholder"),
        },
        symbol: {
          label: t("fields.symbol.label"),
          placeholder: t("fields.symbol.placeholder"),
        },
        type: {
          label: t("fields.type.label"),
          placeholder: t("fields.type.placeholder"),
          locked: t("fields.type.locked"),
        },
        isActive: {
          label: t("fields.isActive.label"),
          description: t("fields.isActive.description"),
        },
      },
      types: {
        count: t("type.count"),
        weight: t("type.weight"),
        length: t("type.length"),
        area: t("type.area"),
        volume: t("type.volume"),
      },
      actions: {
        cancel: t("actions.cancel"),
      },
      create: {
        title: t("create.title"),
        description: t("create.description"),
        submitLabel: t("create.submitLabel"),
        submittingLabel: t("create.submittingLabel"),
      },
      update: {
        title: t("update.title"),
        description: t("update.description"),
        submitLabel: t("update.submitLabel"),
        submittingLabel: t("update.submittingLabel"),
      },
    }),
    [t]
  )
}

