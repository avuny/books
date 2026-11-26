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
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { UnitCollectionButton, UnitCollectionDialog } from "../forms"
import {
  unitLabel,
  useDeleteUnitCollectionMutation,
  useUnitAbilities,
  useUnitCollectionList,
} from "../unit-collection-api"
import type { UnitCollectionListItemDto } from "../types"
import { createUnitCollectionColumns } from "./unit-collection-columns"
import { UnitCollectionMobileCard } from "./unit-collection-mobile-card"

type UnitCollectionListProps = {
  orgId: string
  /** The route decides how to navigate to the collection page. */
  onViewCollection: (collectionId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function UnitCollectionList({
  orgId,
  onViewCollection,
}: UnitCollectionListProps) {
  const { t, i18n } = useTranslation("unit-collection")

  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [collectionToEdit, setCollectionToEdit] =
    useState<UnitCollectionListItemDto | null>(null)
  const [collectionToDelete, setCollectionToDelete] =
    useState<UnitCollectionListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((current) => ({ ...current, pageIndex: 0 })),
    []
  )

  const { collections, total, isLoading } = useUnitCollectionList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search,
  })
  const abilities = useUnitAbilities(orgId)
  const deleteMutation = useDeleteUnitCollectionMutation(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && collections.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((current) => ({
        ...current,
        pageIndex: current.pageIndex - 1,
      }))
    }
  }, [isLoading, collections.length, pagination.pageIndex])

  const formatDate = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
        new Date(iso)
      ),
    [i18n.language]
  )

  /* --------------------------------- actions ------------------------------- */
  const getActions = useCallback(
    (collection: UnitCollectionListItemDto): RowAction[] => {
      const actions: RowAction[] = [
        {
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewCollection(collection.id),
        },
      ]
      if (abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setCollectionToEdit(collection),
        })
      }
      if (abilities.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          // A collection that items use can't be deleted.
          disabled: collection.itemCount > 0,
          onSelect: () => setCollectionToDelete(collection),
        })
      }
      return actions
    },
    [t, onViewCollection, abilities.canUpdate, abilities.canDelete]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = useMemo(
    () =>
      createUnitCollectionColumns({
        copy: {
          name: t("table.name"),
          baseUnit: t("table.baseUnit"),
          units: t("table.units"),
          items: t("table.items"),
          updated: t("table.updated"),
          actions: t("table.actions"),
          actionsFor: (name) => t("table.actionsFor", { name }),
          unitLabel,
          formatDate,
        },
        getActions,
      }),
    [t, getActions, formatDate]
  )

  const table = useDataTable<UnitCollectionListItemDto>({
    data: collections,
    columns,
    getRowId: (collection) => collection.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* --------------------------------- delete -------------------------------- */
  const closeDeleteDialog = () => {
    setCollectionToDelete(null)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!collectionToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({
        orgId,
        collectionId: collectionToDelete.id,
      })
      closeDeleteDialog()
    } catch (e) {
      setDeleteError(parseApiError(e).message || null)
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
        actions={
          abilities.canCreate ? <UnitCollectionButton orgId={orgId} /> : null
        }
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(collection) => onViewCollection(collection.id)}
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
          <UnitCollectionMobileCard
            collection={row.original}
            copy={{
              baseUnitLabel: t("table.baseUnit"),
              unitsLabel: t("table.units"),
              itemsLabel: t("table.items"),
              unitLabel,
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", {
              name: row.original.name,
            })}
            onClick={() => onViewCollection(row.original.id)}
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
              pageOf: (page, pageCount) =>
                t("pagination.pageOf", { page, pageCount }),
              pageLabel: (page) => t("pagination.goTo", { page }),
            }}
          />
        }
      />

      {collectionToEdit ? (
        <UnitCollectionDialog
          orgId={orgId}
          collectionId={collectionToEdit.id}
          open
          onOpenChange={(open) => {
            if (!open) setCollectionToEdit(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={collectionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        title={t("delete.title")}
        description={
          deleteError ??
          t("delete.description", { name: collectionToDelete?.name })
        }
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
