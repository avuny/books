import { useCallback, useState } from "react"
import { Barcode, Eye, FolderPlus, Lock, LockOpen, MoveRight, Pencil, Power, PowerOff, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog, type RowAction } from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  BarcodeLocationDialog,
  BlockLocationDialog,
  DeactivateLocationDialog,
  LocationDialog,
  MoveLocationDialog,
} from "../forms"
import { getLocationActionAvailability, isLocationReadOnly } from "../lib"
import type { LocationParentRef, LocationWarehouse, WarehouseLocationListItemDto } from "../types"
import {
  useDeactivateLocationMutation,
  useDeleteLocationMutation,
  useLocationAbilities,
  useReactivateLocationMutation,
  useUnblockLocationMutation,
} from "../warehouse-location-api"

/** The facts the menu needs; list rows, tree nodes and the details DTO all satisfy it. */
export type LocationActionTarget = Pick<
  WarehouseLocationListItemDto,
  "id" | "name" | "fullCode" | "type" | "isStockable" | "isActive" | "isBlocked"
>

type DialogState =
  | { kind: "edit" | "move" | "block" | "barcode" | "deactivate" | "delete"; location: LocationActionTarget }
  | { kind: "addChild"; location: LocationActionTarget }
  | null

type GetActionsOptions = {
  /** Adds a "View" entry (lists and trees navigate to the details page). */
  onView?: () => void
  /** The details page already has its own edit button. Default true. */
  includeEdit?: boolean
}

type UseLocationActionsOptions = {
  /** Called after a location was deleted (the details page navigates away). */
  onDeleted?: (locationId: string) => void
}

// Composition only: wires permissions, rules, mutations and dialogs into row/menu actions
// shared by the table, the tree and the details page of one warehouse's locations.
export function useLocationActions(
  orgId: string,
  warehouse: LocationWarehouse | null,
  { onDeleted }: UseLocationActionsOptions = {}
) {
  const { t } = useTranslation("warehouse-location")
  const abilities = useLocationAbilities(orgId)
  const readOnly = isLocationReadOnly(warehouse)
  const warehouseId = warehouse?.id ?? ""

  const [dialog, setDialog] = useState<DialogState>(null)
  const [cascade, setCascade] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  /** Errors of actions without a dialog (unblock, reactivate); shown by the page. */
  const [actionError, setActionError] = useState<string | null>(null)

  const deactivateMutation = useDeactivateLocationMutation(orgId, warehouseId)
  const reactivateMutation = useReactivateLocationMutation(orgId, warehouseId)
  const unblockMutation = useUnblockLocationMutation(orgId, warehouseId)
  const deleteMutation = useDeleteLocationMutation(orgId, warehouseId)

  const closeDialog = () => {
    setDialog(null)
    setCascade(false)
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
    if (dialog?.kind !== "deactivate") return
    setDialogError(null)
    try {
      await deactivateMutation.mutateAsync({
        orgId,
        locationId: dialog.location.id,
        params: { cascade: cascade ? "true" : "false" },
      })
      closeDialog()
    } catch (e) {
      setDialogError(parseApiError(e).message || null) // dialog stays open and shows the server message
    }
  }

  const handleDelete = async () => {
    if (dialog?.kind !== "delete") return
    setDialogError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, locationId: dialog.location.id })
      const deletedId = dialog.location.id
      closeDialog()
      onDeleted?.(deletedId)
    } catch (e) {
      setDialogError(parseApiError(e).message || null)
    }
  }

  /** Menu entries: view → edit → add child → move → block → barcode → retire/reactivate → delete (separated). */
  const getActions = useCallback(
    (location: LocationActionTarget, { onView, includeEdit = true }: GetActionsOptions = {}): RowAction[] => {
      const a = getLocationActionAvailability(location, abilities, readOnly)
      const icon = "size-4"
      const actions: RowAction[] = []
      if (onView) actions.push({ id: "view", label: t("actions.view"), icon: <Eye className={icon} />, onSelect: onView })
      if (includeEdit && a.canEdit) actions.push({ id: "edit", label: t("actions.edit"), icon: <Pencil className={icon} />, onSelect: () => setDialog({ kind: "edit", location }) })
      if (a.canAddChild) actions.push({ id: "add-child", label: t("actions.addChild"), icon: <FolderPlus className={icon} />, onSelect: () => setDialog({ kind: "addChild", location }) })
      if (a.canMove) actions.push({ id: "move", label: t("actions.move"), icon: <MoveRight className={`${icon} rtl:rotate-180`} />, onSelect: () => setDialog({ kind: "move", location }) })
      if (a.canBlock) actions.push({ id: "block", label: t("actions.block"), icon: <Lock className={icon} />, onSelect: () => setDialog({ kind: "block", location }) })
      if (a.canUnblock) {
        actions.push({
          id: "unblock",
          label: t("actions.unblock"),
          icon: <LockOpen className={icon} />,
          onSelect: () => void runDirect(() => unblockMutation.mutateAsync({ orgId, locationId: location.id })),
        })
      }
      if (a.canChangeBarcode) actions.push({ id: "barcode", label: t("actions.changeBarcode"), icon: <Barcode className={icon} />, onSelect: () => setDialog({ kind: "barcode", location }) })
      if (a.canDeactivate) actions.push({ id: "deactivate", label: t("actions.deactivate"), icon: <PowerOff className={icon} />, onSelect: () => setDialog({ kind: "deactivate", location }) })
      if (a.canReactivate) {
        actions.push({
          id: "reactivate",
          label: t("actions.reactivate"),
          icon: <Power className={icon} />,
          onSelect: () => void runDirect(() => reactivateMutation.mutateAsync({ orgId, locationId: location.id })),
        })
      }
      if (a.canDelete) actions.push({ id: "delete", label: t("actions.delete"), icon: <Trash2 className={icon} />, variant: "destructive", separatorBefore: true, onSelect: () => setDialog({ kind: "delete", location }) })
      return actions
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation objects are stable enough; orgId drives them
    [t, abilities, readOnly, orgId]
  )

  const target = dialog?.location
  const asParent = (l: LocationActionTarget): LocationParentRef => ({ id: l.id, name: l.fullCode, type: l.type })

  const dialogs = warehouse ? (
    <>
      {dialog?.kind === "edit" && target ? (
        <LocationDialog orgId={orgId} warehouse={warehouse} locationId={target.id} open onOpenChange={(open) => { if (!open) closeDialog() }} />
      ) : null}
      {dialog?.kind === "addChild" && target ? (
        <LocationDialog orgId={orgId} warehouse={warehouse} parent={asParent(target)} open onOpenChange={(open) => { if (!open) closeDialog() }} />
      ) : null}
      {dialog?.kind === "move" && target ? (
        <MoveLocationDialog orgId={orgId} warehouseId={warehouse.id} locationId={target.id} open onOpenChange={(open) => { if (!open) closeDialog() }} />
      ) : null}
      {dialog?.kind === "block" && target ? (
        <BlockLocationDialog orgId={orgId} warehouseId={warehouse.id} locationId={target.id} open onOpenChange={(open) => { if (!open) closeDialog() }} />
      ) : null}
      {dialog?.kind === "barcode" && target ? (
        <BarcodeLocationDialog orgId={orgId} warehouseId={warehouse.id} locationId={target.id} open onOpenChange={(open) => { if (!open) closeDialog() }} />
      ) : null}

      <DeactivateLocationDialog
        open={dialog?.kind === "deactivate"}
        onOpenChange={(open) => { if (!open) closeDialog() }}
        copy={{
          title: t("deactivate.title"),
          description: t("deactivate.description", { name: target?.fullCode }),
          cascadeLabel: t("fields.cascade.label"),
          cascadeDescription: t("fields.cascade.description"),
          confirmLabel: t("deactivate.submitLabel"),
          cancelLabel: t("actions.cancel"),
        }}
        cascade={cascade}
        onCascadeChange={setCascade}
        isLoading={deactivateMutation.isPending}
        errorMessage={dialogError}
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => { if (!open) closeDialog() }}
        title={t("delete.title")}
        description={dialogError ?? t("delete.description", { name: target?.fullCode })}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  ) : null

  return { abilities, readOnly, getActions, dialogs, actionError, clearActionError: () => setActionError(null) }
}
