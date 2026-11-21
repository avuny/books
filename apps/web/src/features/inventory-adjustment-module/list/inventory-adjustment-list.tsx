import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { CheckCircle2, Eye, Pencil, Trash2, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  ConfirmDialog,
  DataTable,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { InventoryAdjustmentButton, InventoryAdjustmentDialog } from "../forms"
import { useInventoryAdjustmentLabels } from "../lib"
import {
  useCancelInventoryAdjustmentMutation,
  useConfirmInventoryAdjustmentMutation,
  useDeleteInventoryAdjustmentMutation,
  useInventoryAdjustmentAbilities,
  useInventoryAdjustmentList,
} from "../inventory-adjustment-api"
import type {
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentScope,
} from "../types"
import { createInventoryAdjustmentColumns } from "./inventory-adjustment-columns"
import { InventoryAdjustmentMobileCard } from "./inventory-adjustment-mobile-card"

const SCOPES: readonly InventoryAdjustmentScope[] = [
  "all",
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
]

type InventoryAdjustmentListProps = {
  orgId: string
  onViewAdjustment: (id: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function InventoryAdjustmentList({
  orgId,
  onViewAdjustment,
}: InventoryAdjustmentListProps) {
  const { t } = useTranslation("inventory-adjustment")

  /* state */
  const [scope, setScope] = useState<InventoryAdjustmentScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const [adjustmentToEdit, setAdjustmentToEdit] =
    useState<InventoryAdjustmentListItemDto | null>(null)
  const [adjustmentToDelete, setAdjustmentToDelete] =
    useState<InventoryAdjustmentListItemDto | null>(null)
  const [adjustmentToConfirm, setAdjustmentToConfirm] =
    useState<InventoryAdjustmentListItemDto | null>(null)
  const [adjustmentToCancel, setAdjustmentToCancel] =
    useState<InventoryAdjustmentListItemDto | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((c) => ({ ...c, pageIndex: 0 })),
    []
  )

  /* data */
  const { adjustments, total, isLoading } = useInventoryAdjustmentList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    scope,
    search,
  })

  const abilities = useInventoryAdjustmentAbilities(orgId)
  const { getStatusLabel } = useInventoryAdjustmentLabels()

  const deleteMutation = useDeleteInventoryAdjustmentMutation(orgId)
  const confirmMutation = useConfirmInventoryAdjustmentMutation(orgId)
  const cancelMutation = useCancelInventoryAdjustmentMutation(orgId)

  // Avoid empty page after deleting last row
  useEffect(() => {
    if (!isLoading && adjustments.length === 0 && pagination.pageIndex > 0) {
      setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
    }
  }, [isLoading, adjustments.length, pagination.pageIndex])

  /* row actions */
  const getActions = useCallback(
    (item: InventoryAdjustmentListItemDto): RowAction[] => {
      const isDraft = item.status === "DRAFT"
      const actions: RowAction[] = [
        {
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewAdjustment(item.id),
        },
      ]

      if (isDraft && abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setAdjustmentToEdit(item),
        })
      }

      if (isDraft && abilities.canConfirm) {
        actions.push({
          id: "confirm",
          label: t("actions.confirm"),
          icon: <CheckCircle2 className="size-4 text-primary" />,
          onSelect: () => setAdjustmentToConfirm(item),
        })
      }

      if (isDraft && abilities.canCancel) {
        actions.push({
          id: "cancel",
          label: t("actions.cancel"),
          icon: <XCircle className="size-4 text-muted-foreground" />,
          separatorBefore: true,
          onSelect: () => setAdjustmentToCancel(item),
        })
      }

      if (isDraft && abilities.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          onSelect: () => setAdjustmentToDelete(item),
        })
      }

      return actions
    },
    [
      t,
      onViewAdjustment,
      abilities.canUpdate,
      abilities.canConfirm,
      abilities.canCancel,
      abilities.canDelete,
    ]
  )

  /* columns + table */
  const columns = useMemo(
    () =>
      createInventoryAdjustmentColumns({
        copy: {
          number: t("table.number"),
          date: t("table.date"),
          referenceNumber: t("fields.referenceNumber"),
          items: t("table.items"),
          status: t("table.status"),
          actions: t("fields.status"),
          actionsFor: (num) => `${t("actions.view")} ${num}`,
          getStatusLabel,
        },
        getActions,
      }),
    [t, getActions, getStatusLabel]
  )

  const table = useDataTable<InventoryAdjustmentListItemDto>({
    data: adjustments,
    columns,
    getRowId: (row) => row.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* action handlers */
  const handleDelete = async () => {
    if (!adjustmentToDelete) return
    setActionError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, id: adjustmentToDelete.id })
      setAdjustmentToDelete(null)
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const handleConfirm = async () => {
    if (!adjustmentToConfirm) return
    setActionError(null)
    try {
      await confirmMutation.mutateAsync({ orgId, id: adjustmentToConfirm.id })
      setAdjustmentToConfirm(null)
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const handleCancel = async () => {
    if (!adjustmentToCancel) return
    setActionError(null)
    try {
      await cancelMutation.mutateAsync({ orgId, id: adjustmentToCancel.id })
      setAdjustmentToCancel(null)
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">
          {t("list.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.title")}
        value={scope}
        onValueChange={(val) => {
          const next = SCOPES.find((s) => s === val)
          if (!next) return
          setScope(next)
          resetPage()
        }}
        tabs={SCOPES.map((item) => ({
          value: item,
          label:
            item === "all" ? t("labels.direction.BOTH") : getStatusLabel(item),
        }))}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => {
              setSearch(next)
              resetPage()
            }}
            placeholder={t("fields.number")}
            clearLabel="Clear"
          />
        }
        actions={
          abilities.canCreate ? (
            <InventoryAdjustmentButton orgId={orgId} />
          ) : null
        }
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(row) => onViewAdjustment(row.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("empty.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        }
        renderMobileCard={(row) => (
          <InventoryAdjustmentMobileCard
            adjustment={row.original}
            copy={{
              dateLabel: t("table.date"),
              itemsLabel: t("table.items"),
              getStatusLabel,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={row.original.number}
            onClick={() => onViewAdjustment(row.original.id)}
          />
        )}
        footer={
          <DataTablePagination
            {...paginationProps}
            copy={{
              navLabel: "Pagination",
              previous: "Previous",
              next: "Next",
              rowsPerPage: "Rows per page",
              summary: ({ from, to, total: count }) =>
                t("pagination.showing", { from, to, total: count }),
              pageOf: (page, count) => `${page} / ${count}`,
              pageLabel: (page) => `Page ${page}`,
            }}
          />
        }
      />

      {/* Edit Dialog */}
      {adjustmentToEdit ? (
        <InventoryAdjustmentDialog
          orgId={orgId}
          adjustmentId={adjustmentToEdit.id}
          open
          onOpenChange={(open) => {
            if (!open) setAdjustmentToEdit(null)
          }}
        />
      ) : null}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={adjustmentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentToDelete(null)
            setActionError(null)
          }
        }}
        title={t("delete.title")}
        description={actionError ?? t("delete.message")}
        confirmLabel={t("actions.delete")}
        cancelLabel="Cancel"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />

      {/* Confirm and Post Confirmation */}
      <ConfirmDialog
        open={adjustmentToConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentToConfirm(null)
            setActionError(null)
          }
        }}
        title={t("actions.confirm")}
        description={
          actionError ??
          "Confirming this adjustment will post a stock movement and general ledger journal entry. Confirmed adjustments cannot be edited or undone."
        }
        confirmLabel={t("actions.confirm")}
        cancelLabel="Cancel"
        isLoading={confirmMutation.isPending}
        onConfirm={handleConfirm}
      />

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={adjustmentToCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentToCancel(null)
            setActionError(null)
          }
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
    </div>
  )
}
