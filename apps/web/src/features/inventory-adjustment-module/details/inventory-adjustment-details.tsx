import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { ConfirmDialog } from "@workspace/ui/blocks/data-table"

import {
  useCancelInventoryAdjustmentMutation,
  useConfirmInventoryAdjustmentMutation,
  useDeleteInventoryAdjustmentMutation,
  useInventoryAdjustment,
  useInventoryAdjustmentAbilities,
} from "../inventory-adjustment-api"
import { useInventoryAdjustmentLabels } from "../lib"
import { InventoryAdjustmentDialog } from "../forms"
import { InventoryAdjustmentDetailsView } from "./inventory-adjustment-details-view"

type InventoryAdjustmentDetailsProps = {
  orgId: string
  adjustmentId: string
  onBack?: () => void
}

// Composition only: strings + API behavior wired into the pure details view.
export function InventoryAdjustmentDetails({
  orgId,
  adjustmentId,
  onBack,
}: InventoryAdjustmentDetailsProps) {
  const { t } = useTranslation("inventory-adjustment")
  const { adjustment, isLoading, error } = useInventoryAdjustment(
    orgId,
    adjustmentId
  )
  const abilities = useInventoryAdjustmentAbilities(orgId)
  const { getStatusLabel } = useInventoryAdjustmentLabels()

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const confirmMutation = useConfirmInventoryAdjustmentMutation(orgId)
  const cancelMutation = useCancelInventoryAdjustmentMutation(orgId)
  const deleteMutation = useDeleteInventoryAdjustmentMutation(orgId)

  const handleConfirm = async () => {
    setActionError(null)
    try {
      await confirmMutation.mutateAsync({ orgId, id: adjustmentId })
      setIsConfirmDialogOpen(false)
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const handleCancel = async () => {
    setActionError(null)
    try {
      await cancelMutation.mutateAsync({ orgId, id: adjustmentId })
      setIsCancelDialogOpen(false)
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const handleDelete = async () => {
    setActionError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, id: adjustmentId })
      setIsDeleteDialogOpen(false)
      onBack?.()
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const copy = {
    backLabel: t("actions.backToList", { defaultValue: "Back to adjustments" }),
    title: t("details.title", { defaultValue: "Adjustment details" }),
    date: t("fields.date", { defaultValue: "Adjustment date" }),
    referenceNumber: t("fields.referenceNumber", { defaultValue: "Reference number" }),
    warehouse: t("fields.warehouse", { defaultValue: "Warehouse" }),
    reason: t("fields.reason", { defaultValue: "Adjustment reason" }),
    description: t("fields.description", { defaultValue: "Description" }),
    status: t("fields.status", { defaultValue: "Status" }),
    linesTitle: t("details.linesSummary", { defaultValue: "Adjusted items" }),
    stockMovement: t("details.stockMovement", { defaultValue: "Stock movement" }),
    journalEntry: t("details.journalEntry", { defaultValue: "Journal entry" }),
    confirmedBy: t("details.confirmedBy", { defaultValue: "Confirmed by" }),
    confirmedAt: t("details.confirmedAt", { defaultValue: "Confirmed at" }),
    createdBy: t("details.createdBy", { defaultValue: "Created by" }),
    createdAt: t("details.createdAt", { defaultValue: "Created at" }),
    overview: t("details.overview", { defaultValue: "Overview" }),
    documentInfo: t("details.documentInfo", { defaultValue: "Document details" }),
    auditInfo: t("details.auditInfo", { defaultValue: "Audit & Postings" }),
    totalLines: t("details.totalLines", { defaultValue: "Total items" }),
    increases: t("details.increases", { defaultValue: "Increases" }),
    decreases: t("details.decreases", { defaultValue: "Decreases" }),
    noChange: t("details.noChange", { defaultValue: "No change" }),
    netDifference: t("details.netDifference", { defaultValue: "Net difference" }),
    pendingPosting: t("details.pendingPosting", { defaultValue: "Pending confirmation" }),
    noItems: t("details.noItems", { defaultValue: "No items recorded in this adjustment." }),
    fields: {
      item: t("fields.item", { defaultValue: "Item" }),
      location: t("fields.location", { defaultValue: "Location" }),
      unit: t("fields.unit", { defaultValue: "Unit" }),
      batch: t("fields.batch", { defaultValue: "Batch" }),
      countedQuantity: t("fields.countedQuantity", { defaultValue: "Counted quantity" }),
      systemQuantity: t("fields.systemQuantity", { defaultValue: "System quantity" }),
      difference: t("fields.difference", { defaultValue: "Difference" }),
      notes: t("fields.notes", { defaultValue: "Notes" }),
    },
    actions: {
      edit: t("actions.edit", { defaultValue: "Edit draft" }),
      confirm: t("actions.confirm", { defaultValue: "Confirm" }),
      cancel: t("actions.cancel", { defaultValue: "Cancel adjustment" }),
      delete: t("actions.delete", { defaultValue: "Delete" }),
    },
    getStatusLabel,
  }

  return (
    <>
      <InventoryAdjustmentDetailsView
        adjustment={adjustment}
        isLoading={isLoading}
        errorMessage={error ? parseApiError(error).message : null}
        copy={copy}
        canUpdate={abilities.canUpdate}
        canConfirm={abilities.canConfirm}
        canCancel={abilities.canCancel}
        canDelete={abilities.canDelete}
        onBack={onBack}
        onEdit={() => setIsEditDialogOpen(true)}
        onConfirm={() => setIsConfirmDialogOpen(true)}
        onCancel={() => setIsCancelDialogOpen(true)}
        onDelete={() => setIsDeleteDialogOpen(true)}
      />

      {isEditDialogOpen && (
        <InventoryAdjustmentDialog
          orgId={orgId}
          adjustmentId={adjustmentId}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}

      <ConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          setIsConfirmDialogOpen(open)
          if (!open) setActionError(null)
        }}
        title={t("actions.confirmTitle", { defaultValue: "Confirm inventory adjustment" })}
        description={actionError ?? t("actions.confirmDescription", { defaultValue: "Confirming this adjustment will post a stock movement and general ledger journal entry. Confirmed adjustments cannot be edited or undone." })}
        confirmLabel={t("actions.confirm", { defaultValue: "Confirm" })}
        cancelLabel={t("actions.back", { defaultValue: "Back" })}
        isLoading={confirmMutation.isPending}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          setIsCancelDialogOpen(open)
          if (!open) setActionError(null)
        }}
        title={t("actions.cancelTitle", { defaultValue: "Cancel inventory adjustment" })}
        description={
          actionError ??
          t("actions.cancelDescription", {
            defaultValue: "Are you sure you want to cancel this draft adjustment? No stock will be affected.",
          })
        }
        confirmLabel={t("actions.cancel", { defaultValue: "Cancel adjustment" })}
        cancelLabel={t("actions.back", { defaultValue: "Back" })}
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setActionError(null)
        }}
        title={t("delete.title", { defaultValue: "Delete adjustment" })}
        description={actionError ?? t("delete.message", { defaultValue: "Are you sure you want to delete this draft adjustment? This action cannot be undone." })}
        confirmLabel={t("actions.delete", { defaultValue: "Delete" })}
        cancelLabel={t("actions.back", { defaultValue: "Back" })}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
