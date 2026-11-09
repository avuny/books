import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

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
import { parseApiError } from "@workspace/ui/lib/api-error"

import { unitLabel } from "../../unit-module"
import { ItemButton, ItemDialog } from "../forms"
import { useDeleteItemMutation, useItemAbilities, useItemList } from "../item-api"
import type { ItemListItemDto, ItemStatus } from "../types"
import { createItemColumns } from "./item-columns"
import { ItemMobileCard } from "./item-mobile-card"

const STATUSES: readonly ItemStatus[] = ["all", "active", "inactive"]

type ItemListProps = {
  orgId: string
  /** The route decides how to navigate to the item page. */
  onViewItem: (itemId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function ItemList({ orgId, onViewItem }: ItemListProps) {
  const { t } = useTranslation("item")

  const [status, setStatus] = useState<ItemStatus>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [itemToEdit, setItemToEdit] = useState<ItemListItemDto | null>(null)
  const [itemToDelete, setItemToDelete] = useState<ItemListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((current) => ({ ...current, pageIndex: 0 })),
    []
  )

  const { items, total, isLoading } = useItemList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status,
    search,
  })
  const abilities = useItemAbilities(orgId)
  const deleteMutation = useDeleteItemMutation(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && items.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((current) => ({ ...current, pageIndex: current.pageIndex - 1 }))
    }
  }, [isLoading, items.length, pagination.pageIndex])

  /* --------------------------------- actions ------------------------------- */
  const getActions = useCallback(
    (item: ItemListItemDto): RowAction[] => {
      const actions: RowAction[] = [
        {
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewItem(item.id),
        },
      ]
      if (abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setItemToEdit(item),
        })
      }
      if (abilities.canDelete) {
        // The server refuses items with stock history (ITEM_HAS_HISTORY); the message shows in the dialog.
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          onSelect: () => setItemToDelete(item),
        })
      }
      return actions
    },
    [t, onViewItem, abilities.canUpdate, abilities.canDelete]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = useMemo(
    () =>
      createItemColumns({
        copy: {
          name: t("table.name"),
          category: t("table.category"),
          baseUnit: t("table.baseUnit"),
          tracking: t("table.tracking"),
          status: t("table.status"),
          actions: t("table.actions"),
          activeLabel: t("type.active"),
          inactiveLabel: t("type.inactive"),
          trackedLabel: t("type.tracked"),
          untrackedLabel: t("type.untracked"),
          batchLabel: t("type.batch"),
          actionsFor: (name) => t("table.actionsFor", { name }),
          unitLabel,
        },
        getActions,
      }),
    [t, getActions]
  )

  const table = useDataTable<ItemListItemDto>({
    data: items,
    columns,
    getRowId: (item) => item.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* --------------------------------- delete -------------------------------- */
  const closeDeleteDialog = () => {
    setItemToDelete(null)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, itemId: itemToDelete.id })
      closeDeleteDialog()
    } catch (e) {
      setDeleteError(parseApiError(e).message || null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{t("list.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={status}
        onValueChange={(value) => {
          const next = STATUSES.find((item) => item === value)
          if (!next) return
          setStatus(next)
          resetPage()
        }}
        tabs={STATUSES.map((item) => ({ value: item, label: t(`list.tabs.${item}`) }))}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => {
              setSearch(next)
              resetPage()
            }}
            placeholder={t("list.search.placeholder")}
            clearLabel={t("list.search.clear")}
          />
        }
        actions={abilities.canCreate ? <ItemButton orgId={orgId} /> : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(item) => onViewItem(item.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        }
        renderMobileCard={(row) => (
          <ItemMobileCard
            item={row.original}
            copy={{
              activeLabel: t("type.active"),
              inactiveLabel: t("type.inactive"),
              categoryLabel: t("table.category"),
              baseUnitLabel: t("table.baseUnit"),
              unitLabel,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", { name: row.original.name })}
            onClick={() => onViewItem(row.original.id)}
          />
        )}
        footer={
          <DataTablePagination
            {...paginationProps}
            copy={{
              navLabel: t("pagination.nav"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              rowsPerPage: t("pagination.rowsPerPage"),
              summary: ({ from, to, total: count }) =>
                t("pagination.summary", { from, to, total: count }),
              pageOf: (page, pageCount) => t("pagination.pageOf", { page, pageCount }),
              pageLabel: (page) => t("pagination.goTo", { page }),
            }}
          />
        }
      />

      {itemToEdit ? (
        <ItemDialog
          orgId={orgId}
          itemId={itemToEdit.id}
          open
          onOpenChange={(open) => {
            if (!open) setItemToEdit(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={itemToDelete !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        title={t("delete.title")}
        description={deleteError ?? t("delete.description", { name: itemToDelete?.name })}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
