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
  const { adjustment, isLoading, error } = useInventoryAdjustment(orgId, adjustmentId)
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
    backLabel: "Back to list",
    title: t("details.title"),
    date: t("fields.date"),
    referenceNumber: t("fields.referenceNumber"),
    warehouse: t("fields.warehouse"),
    reason: t("fields.reason"),
    description: t("fields.description"),
    status: t("fields.status"),
    linesTitle: t("details.linesSummary"),
    stockMovement: t("details.stockMovement"),
    journalEntry: t("details.journalEntry"),
    confirmedBy: t("details.confirmedBy"),
    confirmedAt: t("details.confirmedAt"),
    fields: {
      item: t("fields.item"),
      location: t("fields.location"),
      unit: t("fields.unit"),
      batch: t("fields.batch"),
      countedQuantity: t("fields.countedQuantity"),
      systemQuantity: t("fields.systemQuantity"),
      difference: t("fields.difference"),
      notes: t("fields.notes"),
    },
    actions: {
      edit: t("actions.edit"),
      confirm: t("actions.confirm"),
      cancel: t("actions.cancel"),
      delete: t("actions.delete"),
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
        title={t("actions.confirm")}
        description={
          actionError ??
          "Confirming this adjustment will post a stock movement and general ledger journal entry. Confirmed adjustments cannot be edited or undone."
        }
        confirmLabel={t("actions.confirm")}
        cancelLabel="Back"
        isLoading={confirmMutation.isPending}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          setIsCancelDialogOpen(open)
          if (!open) setActionError(null)
        }}
        title={t("actions.cancel")}
        description={
          actionError ??
          "Are you sure you want to cancel this draft adjustment? No stock will be affected."
        }
        confirmLabel={t("actions.cancel")}
        cancelLabel="Back"
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setActionError(null)
        }}
        title={t("delete.title")}
        description={actionError ?? t("delete.message")}
        confirmLabel={t("actions.delete")}
        cancelLabel="Back"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
