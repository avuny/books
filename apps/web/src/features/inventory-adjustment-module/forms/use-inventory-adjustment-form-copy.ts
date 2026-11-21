import { useTranslation } from "react-i18next"
import type { InventoryAdjustmentFormCopy } from "./inventory-adjustment-form-types"

export function useInventoryAdjustmentFormCopy(
  mode: "create" | "update"
): InventoryAdjustmentFormCopy {
  const { t } = useTranslation("inventory-adjustment")

  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    referenceNumber: {
      label: t("fields.referenceNumber"),
      placeholder: "REF-...",
    },
    date: {
      label: t("fields.date"),
      placeholder: "YYYY-MM-DD",
    },
    warehouse: {
      label: t("fields.warehouse"),
      placeholder: "Select warehouse...",
    },
    direction: {
      label: t("fields.direction"),
      decrease: t("labels.direction.DECREASE"),
      increase: t("labels.direction.INCREASE"),
      both: t("labels.direction.BOTH"),
    },
    reason: {
      label: t("fields.reason"),
      placeholder: "Select reason...",
    },
    formDescription: {
      label: t("fields.description"),
      placeholder: "Optional notes...",
    },
    linesTitle: t("details.linesSummary"),
    addLine: t("actions.addLine"),
    removeLine: t("actions.removeLine"),
    noLines: t("empty.description"),
    fields: {
      item: {
        label: t("fields.item"),
        placeholder: "Select item...",
      },
      location: {
        label: t("fields.location"),
        placeholder: "Select location...",
      },
      unit: {
        label: t("fields.unit"),
        placeholder: "Select unit...",
      },
      batch: {
        label: t("fields.batch"),
        placeholder: "Select batch...",
      },
      newBatch: t("actions.addBatch", { defaultValue: "+ New Batch" }),
      countedQuantity: {
        label: t("fields.countedQuantity"),
        placeholder: "0.0000",
      },
      systemQuantity: t("fields.systemQuantity"),
      difference: t("fields.difference"),
      notes: {
        label: t("fields.notes"),
        placeholder: "Line notes...",
      },
    },
    submitDraftLabel: t("create.saveDraft"),
    submittingDraftLabel: t("create.saveDraft"),
    submitConfirmLabel: t("create.confirm"),
    submittingConfirmLabel: t("create.confirm"),
  }
}
