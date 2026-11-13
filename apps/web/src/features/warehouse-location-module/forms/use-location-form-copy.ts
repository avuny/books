import { useTranslation } from "react-i18next"
import { WAREHOUSE_LOCATION_BULK_MAX_NODES, WAREHOUSE_LOCATION_PURPOSES } from "@avuny/contracts"

import type { LocationActionFormCopy, LocationBulkFormCopy, LocationFormCopy } from "./location-form-types"

export function useLocationFormCopy(mode: "create" | "update"): LocationFormCopy {
  const { t } = useTranslation("warehouse-location")
  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    parent: {
      label: t("fields.parent.label"),
      placeholder: t("fields.parent.placeholder"),
      fixed: t("fields.parent.fixed"),
    },
    code: {
      label: t("fields.code.label"),
      placeholder: t("fields.code.placeholder"),
      suggest: t("fields.code.suggest"),
    },
    name: {
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
    },
    type: {
      label: t("fields.type.label"),
      placeholder: t("fields.type.placeholder"),
    },
    purpose: {
      label: t("fields.purpose.label"),
      placeholder: t("fields.purpose.placeholder"),
    },
    isStockable: {
      label: t("fields.isStockable.label"),
      description: t("fields.isStockable.description"),
    },
    isPickable: {
      label: t("fields.isPickable.label"),
      description: t("fields.isPickable.description"),
    },
    isReceivable: {
      label: t("fields.isReceivable.label"),
      description: t("fields.isReceivable.description"),
    },
    applyToDescendants: {
      label: t("fields.applyToDescendants.label"),
      description: t("fields.applyToDescendants.description"),
    },
    measures: {
      title: t("fields.measures.title"),
      width: {
        label: t("fields.measures.width"),
        placeholder: "",
      },
      height: {
        label: t("fields.measures.height"),
        placeholder: "",
      },
      depth: {
        label: t("fields.measures.depth"),
        placeholder: "",
      },
      maxWeight: {
        label: t("fields.measures.maxWeight"),
        placeholder: "",
      },
      maxVolume: {
        label: t("fields.measures.maxVolume"),
        placeholder: "",
      },
    },
    purposeOptions: WAREHOUSE_LOCATION_PURPOSES.map((value) => ({
      value,
      label: t(`labels.purposes.${value}`, { defaultValue: value }),
    })),
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}

export function useLocationActionFormCopy(kind: "move" | "block" | "barcode"): LocationActionFormCopy {
  const { t } = useTranslation("warehouse-location")
  return {
    title: t(`${kind}.title`),
    description: t(`${kind}.description`),
    submitLabel: t(`${kind}.submitLabel`),
    submittingLabel: t(`${kind}.submittingLabel`),
  }
}

export function useLocationBulkFormCopy(): LocationBulkFormCopy {
  const { t } = useTranslation("warehouse-location")
  return {
    title: t("bulk.title"),
    description: t("bulk.description"),
    submitLabel: t("bulk.submitLabel"),
    submittingLabel: t("bulk.submittingLabel"),
    parent: {
      label: t("fields.parent.label"),
      placeholder: t("fields.parent.placeholder"),
      fixed: t("fields.parent.fixed"),
    },
    preview: t("bulk.preview"),
    previewing: t("bulk.previewing"),
    total: (count) => t("bulk.total", { count }),
    created: (count) => t("bulk.created", { count }),
    tooMany: t("bulk.tooMany", { max: WAREHOUSE_LOCATION_BULK_MAX_NODES }),
    badOrder: t("bulk.badOrder"),
    examples: t("bulk.examples"),
    level: (number) => t("bulk.level", { number }),
    levelFields: {
      type: t("fields.level.type"),
      prefix: t("fields.level.prefix"),
      start: t("fields.level.start"),
      count: t("fields.level.count"),
      pad: t("fields.level.pad"),
      add: t("fields.level.add"),
      remove: t("fields.level.remove"),
    },
  }
}
