import { useCallback, useState } from "react"
import { Eye, Pencil, Power, PowerOff, Star, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog, type RowAction } from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { WarehouseDialog } from "../forms"
import { getWarehouseActionAvailability } from "../lib"
import type { WarehouseListItemDto } from "../types"
import {
  useDeactivateWarehouseMutation,
  useDeleteWarehouseMutation,
  useReactivateWarehouseMutation,
  useSetDefaultWarehouseMutation,
  useWarehouseAbilities,
} from "../warehouse-api"

export type WarehouseActionTarget = Pick<
  WarehouseListItemDto,
  "id" | "name" | "type" | "isDefault" | "isSystem" | "isActive"
>

type GetActionsOptions = {
  /** Adds a "View" entry (lists navigate to the details page). */
  onView?: () => void
  /** The details page already has its own edit button. Default true. */
  includeEdit?: boolean
}

type UseWarehouseActionsOptions = {
  /** Called after a warehouse was deleted (the details page navigates away). */
  onDeleted?: (warehouseId: string) => void
}

// Composition only: wires permissions, rules, mutations and confirm dialogs into row/menu actions
// shared by the list and the details page.
export function useWarehouseActions(orgId: string, { onDeleted }: UseWarehouseActionsOptions = {}) {
  const { t } = useTranslation("warehouse")
  const abilities = useWarehouseAbilities(orgId)

  const [toEdit, setToEdit] = useState<WarehouseActionTarget | null>(null)
  const [toDeactivate, setToDeactivate] = useState<WarehouseActionTarget | null>(null)
  const [toDelete, setToDelete] = useState<WarehouseActionTarget | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  /** Errors of actions without a dialog (set default, reactivate); shown by the page. */
  const [actionError, setActionError] = useState<string | null>(null)

  const deactivateMutation = useDeactivateWarehouseMutation(orgId)
  const reactivateMutation = useReactivateWarehouseMutation(orgId)
  const setDefaultMutation = useSetDefaultWarehouseMutation(orgId)
  const deleteMutation = useDeleteWarehouseMutation(orgId)

  const closeDialogs = () => {
    setToDeactivate(null)
    setToDelete(null)
    setDialogError(null)
  }

  const runDirect = async (run: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await run()
    } catch (e) {
      setActionError(parseApiError(e).message || null) // already localized by the server
    }
  }

  const handleDeactivate = async () => {
    if (!toDeactivate) return
    setDialogError(null)
    try {
      await deactivateMutation.mutateAsync({ orgId, warehouseId: toDeactivate.id })
      closeDialogs()
    } catch (e) {
      setDialogError(parseApiError(e).message || null) // dialog stays open and shows the server message
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDialogError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, warehouseId: toDelete.id })
      const deletedId = toDelete.id
      closeDialogs()
      onDeleted?.(deletedId)
    } catch (e) {
      setDialogError(parseApiError(e).message || null)
    }
  }

  /** Menu entries: view → edit → default → retire/reactivate → delete (destructive, separated). */
  const getActions = useCallback(
    (warehouse: WarehouseActionTarget, { onView, includeEdit = true }: GetActionsOptions = {}): RowAction[] => {
      const a = getWarehouseActionAvailability(warehouse, abilities)
      const actions: RowAction[] = []
      if (onView) {
        actions.push({ id: "view", label: t("actions.view"), icon: <Eye className="size-4" />, onSelect: onView })
      }
      if (includeEdit && a.canEdit) {
        actions.push({ id: "edit", label: t("actions.edit"), icon: <Pencil className="size-4" />, onSelect: () => setToEdit(warehouse) })
      }
      if (a.canSetDefault) {
        actions.push({
          id: "set-default",
          label: t("actions.setDefault"),
          icon: <Star className="size-4" />,
          onSelect: () => void runDirect(() => setDefaultMutation.mutateAsync({ orgId, warehouseId: warehouse.id })),
        })
      }
      if (a.canDeactivate) {
        actions.push({
          id: "deactivate",
          label: t("actions.deactivate"),
          icon: <PowerOff className="size-4" />,
          disabled: a.deactivateDisabled, // business rule mirrored from the server
          onSelect: () => setToDeactivate(warehouse),
        })
      }
      if (a.canReactivate) {
        actions.push({
          id: "reactivate",
          label: t("actions.reactivate"),
          icon: <Power className="size-4" />,
          onSelect: () => void runDirect(() => reactivateMutation.mutateAsync({ orgId, warehouseId: warehouse.id })),
        })
      }
      if (a.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          disabled: a.deleteDisabled,
          onSelect: () => setToDelete(warehouse),
        })
      }
      return actions
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the mutation objects are stable enough; orgId drives them
    [t, abilities, orgId]
  )

  const dialogs = (
    <>
      {toEdit ? (
        <WarehouseDialog orgId={orgId} warehouseId={toEdit.id} open onOpenChange={(open) => { if (!open) setToEdit(null) }} />
      ) : null}

      <ConfirmDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => { if (!open) closeDialogs() }}
        title={t("deactivate.title")}
        description={dialogError ?? t("deactivate.description", { name: toDeactivate?.name })}
        confirmLabel={t("actions.deactivate")}
        cancelLabel={t("actions.cancel")}
        isLoading={deactivateMutation.isPending}
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => { if (!open) closeDialogs() }}
        title={t("delete.title")}
        description={dialogError ?? t("delete.description", { name: toDelete?.name })}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  )

  return { abilities, getActions, dialogs, actionError, clearActionError: () => setActionError(null) }
}
