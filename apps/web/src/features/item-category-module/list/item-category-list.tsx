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

import { ItemCategoryButton, ItemCategoryDialog } from "../forms"
import {
  useDeleteItemCategoryMutation,
  useItemCategoryAbilities,
  useItemCategoryList,
} from "../item-category-api"
import type { ItemCategoryListItemDto, ItemCategoryStatus } from "../types"
import { createItemCategoryColumns } from "./item-category-columns"
import { ItemCategoryMobileCard } from "./item-category-mobile-card"

const STATUSES: readonly ItemCategoryStatus[] = ["all", "active", "inactive"]

type ItemCategoryListProps = {
  orgId: string
  /** The route decides how to navigate to the category page. */
  onViewCategory: (categoryId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function ItemCategoryList({
  orgId,
  onViewCategory,
}: ItemCategoryListProps) {
  const { t } = useTranslation("item-category")

  const [status, setStatus] = useState<ItemCategoryStatus>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [categoryToEdit, setCategoryToEdit] =
    useState<ItemCategoryListItemDto | null>(null)
  const [categoryToDelete, setCategoryToDelete] =
    useState<ItemCategoryListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetPage = useCallback(
    () => setPagination((current) => ({ ...current, pageIndex: 0 })),
    []
  )

  const { categories, total, isLoading } = useItemCategoryList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status,
    search,
  })
  const abilities = useItemCategoryAbilities(orgId)
  const deleteMutation = useDeleteItemCategoryMutation(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && categories.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((current) => ({
        ...current,
        pageIndex: current.pageIndex - 1,
      }))
    }
  }, [isLoading, categories.length, pagination.pageIndex])

  /* --------------------------------- actions ------------------------------- */
  const getActions = useCallback(
    (category: ItemCategoryListItemDto): RowAction[] => {
      const actions: RowAction[] = [
        {
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewCategory(category.id),
        },
      ]
      if (abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit"),
          icon: <Pencil className="size-4" />,
          onSelect: () => setCategoryToEdit(category),
        })
      }
      if (abilities.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          // Only an unused leaf can be deleted; everything else is deactivated.
          disabled: category.childCount > 0 || category.itemCount > 0,
          onSelect: () => setCategoryToDelete(category),
        })
      }
      return actions
    },
    [t, onViewCategory, abilities.canUpdate, abilities.canDelete]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = useMemo(
    () =>
      createItemCategoryColumns({
        copy: {
          name: t("table.name"),
          subCategories: t("table.subCategories"),
          items: t("table.items"),
          status: t("table.status"),
          actions: t("table.actions"),
          activeLabel: t("type.active"),
          inactiveLabel: t("type.inactive"),
          actionsFor: (name) => t("table.actionsFor", { name }),
        },
        getActions,
      }),
    [t, getActions]
  )

  const table = useDataTable<ItemCategoryListItemDto>({
    data: categories,
    columns,
    getRowId: (category) => category.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  /* --------------------------------- delete -------------------------------- */
  const closeDeleteDialog = () => {
    setCategoryToDelete(null)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!categoryToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({
        orgId,
        categoryId: categoryToDelete.id,
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

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={status}
        onValueChange={(value) => {
          const next = STATUSES.find((item) => item === value)
          if (!next) return
          setStatus(next)
          resetPage()
        }}
        tabs={STATUSES.map((item) => ({
          value: item,
          label: t(`list.tabs.${item}`),
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
            placeholder={t("list.search.placeholder")}
            clearLabel={t("list.search.clear")}
          />
        }
        actions={
          abilities.canCreate ? <ItemCategoryButton orgId={orgId} /> : null
        }
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(category) => onViewCategory(category.id)}
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
          <ItemCategoryMobileCard
            category={row.original}
            copy={{
              activeLabel: t("type.active"),
              inactiveLabel: t("type.inactive"),
              subCategoriesLabel: t("table.subCategories"),
              itemsLabel: t("table.items"),
            }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", {
              name: row.original.name,
            })}
            onClick={() => onViewCategory(row.original.id)}
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

      {categoryToEdit ? (
        <ItemCategoryDialog
          orgId={orgId}
          categoryId={categoryToEdit.id}
          open
          onOpenChange={(open) => {
            if (!open) setCategoryToEdit(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        title={t("delete.title")}
        description={
          deleteError ??
          t("delete.description", { name: categoryToDelete?.name })
        }
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
