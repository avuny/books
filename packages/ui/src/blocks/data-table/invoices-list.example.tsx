/**
 * EXAMPLE container (lives in apps/web, NOT in the ui package).
 * Shows how any module wires the pure components together:
 *   - translations are resolved here and injected as props
 *   - data fetching / mutations are injected from hooks
 *   - only `columns`, `filterFields` and `renderMobileCard` change per module
 *
 * `useInvoicesQuery` / `useDeleteInvoice` are placeholders for your own hooks.
 */
"use client"

import * as React from "react"
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table"
import { Download, Eye, Pencil, Plus, Trash2, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  ConfirmDialog,
  DataTable,
  DataTableActiveFilters,
  DataTableBulkBar,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableMenuButton,
  DataTableMobileCard,
  DataTablePagination,
  DataTableRowActions,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewTabs,
  cleanFilterValues,
  createActionsColumn,
  createSelectionColumn,
  getActiveFilters,
  getTablePaginationProps,
  removeFilterValue,
  useDataTable,
  type FilterField,
  type FilterValues,
  type RowAction,
} from "@workspace/ui/components/data-table"

// Placeholders: replace with your real API hooks.
import { useDeleteInvoice, useInvoicesQuery } from "@/features/invoices/api"

type InvoiceStatus = "draft" | "due" | "paid" | "overdue"

interface Invoice {
  id: string
  number: string
  createdAt: string
  customerName: string
  companyName: string
  total: number
  paid: number
  due: number
  dueDate: string | null
  status: InvoiceStatus
}

const STATUS_VARIANT: Record<
  InvoiceStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  draft: "outline",
  due: "secondary",
  paid: "default",
  overdue: "destructive",
}

const money = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function InvoicesList() {
  const { t } = useTranslation("invoices")

  /* ------------------------------ server state ----------------------------- */
  const [tab, setTab] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<Invoice | null>(
    null
  )

  const resetPage = React.useCallback(
    () => setPagination((p) => ({ ...p, pageIndex: 0 })),
    []
  )

  const query = useInvoicesQuery({
    status: tab === "all" ? undefined : tab,
    search,
    filters,
    sorting,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  })
  const deleteInvoice = useDeleteInvoice()

  /* ------------------------------ translations ----------------------------- */
  const copy = {
    title: t("list.title"),
    create: t("list.create"),
    search: {
      placeholder: t("list.search.placeholder"),
      clear: t("list.search.clear"),
    },
    tabs: {
      aria: t("list.tabs.aria"),
      all: t("list.tabs.all"),
      draft: t("status.draft"),
      due: t("status.due"),
      paid: t("status.paid"),
      overdue: t("status.overdue"),
    },
    filter: {
      triggerLabel: t("filter.trigger"),
      title: t("filter.title"),
      description: t("filter.description"),
      applyLabel: t("filter.apply"),
      resetLabel: t("filter.reset"),
    },
    export: {
      label: t("export.label"),
      csv: t("export.csv"),
      xlsx: t("export.xlsx"),
    },
    import: {
      label: t("import.label"),
      csv: t("import.csv"),
      template: t("import.template"),
    },
    empty: { title: t("empty.title"), description: t("empty.description") },
  }

  /* -------------------------------- filters -------------------------------- */
  const filterFields = React.useMemo<FilterField[]>(
    () => [
      {
        id: "status",
        type: "multiselect",
        label: t("filter.fields.status"),
        options: (["draft", "due", "paid", "overdue"] as const).map((s) => ({
          value: s,
          label: t(`status.${s}`),
        })),
      },
      { id: "customer", type: "text", label: t("filter.fields.customer") },
      {
        id: "total",
        type: "number-range",
        label: t("filter.fields.total"),
        minLabel: t("filter.min"),
        maxLabel: t("filter.max"),
      },
      {
        id: "dueDate",
        type: "date-range",
        label: t("filter.fields.dueDate"),
        fromLabel: t("filter.from"),
        toLabel: t("filter.to"),
      },
    ],
    [t]
  )

  const applyFilters = (next: FilterValues) => {
    setFilters(cleanFilterValues(next))
    resetPage()
  }

  /* --------------------------------- actions ------------------------------- */
  const getActions = React.useCallback(
    (invoice: Invoice): RowAction[] => [
      {
        id: "view",
        label: t("actions.view"),
        icon: <Eye className="size-4" />,
        onSelect: () => console.log("view", invoice.id),
      },
      {
        id: "edit",
        label: t("actions.edit"),
        icon: <Pencil className="size-4" />,
        onSelect: () => console.log("edit", invoice.id),
      },
      {
        id: "delete",
        label: t("actions.delete"),
        icon: <Trash2 className="size-4" />,
        variant: "destructive",
        separatorBefore: true,
        onSelect: () => setInvoiceToDelete(invoice),
      },
    ],
    [t]
  )

  /* --------------------------------- columns ------------------------------- */
  const columns = React.useMemo<ColumnDef<Invoice>[]>(
    () => [
      createSelectionColumn<Invoice>({
        selectAllLabel: t("table.selectAll"),
        selectRowLabel: (row) => t("table.selectRow", { number: row.number }),
      }),
      {
        accessorKey: "number",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.invoice")} />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground">
              {row.original.number}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("table.createdOn", { date: row.original.createdAt })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "customerName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.customer")} />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground">
              {row.original.customerName}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.companyName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "total",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.total")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {money.format(row.original.total)}
          </span>
        ),
      },
      {
        accessorKey: "due",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.due")} />
        ),
        cell: ({ row }) =>
          row.original.due > 0 ? (
            <span className="text-destructive tabular-nums">
              {money.format(row.original.due)}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.dueDate")} />
        ),
        cell: ({ row }) => row.original.dueDate ?? "-",
      },
      {
        accessorKey: "status",
        header: t("table.status"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      createActionsColumn<Invoice>({
        headerLabel: t("table.actions"),
        triggerLabel: (row) => t("table.actionsFor", { number: row.number }),
        getActions,
      }),
    ],
    [t, getActions]
  )

  /* ---------------------------------- table -------------------------------- */
  const table = useDataTable<Invoice>({
    data: query.data?.items ?? [],
    columns,
    getRowId: (row) => row.id,
    manual: true,
    rowCount: query.data?.total ?? 0,
    enableRowSelection: true,
    sorting,
    onSortingChange: (updater) => {
      setSorting(updater)
      resetPage()
    },
    pagination,
    onPaginationChange: setPagination,
    rowSelection,
    onRowSelectionChange: setRowSelection,
  })

  const selectedCount = Object.keys(rowSelection).length
  const activeFilters = getActiveFilters(filterFields, filters)

  const paginationProps = getTablePaginationProps(table)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{copy.title}</h1>
        <Button type="button">
          <Plus className="size-4" aria-hidden />
          {copy.create}
        </Button>
      </div>

      <DataTableViewTabs
        ariaLabel={copy.tabs.aria}
        value={tab}
        onValueChange={(next) => {
          setTab(next)
          resetPage()
        }}
        tabs={[
          {
            value: "all",
            label: copy.tabs.all,
            count: query.data?.counts?.all,
          },
          {
            value: "draft",
            label: copy.tabs.draft,
            count: query.data?.counts?.draft,
          },
          {
            value: "due",
            label: copy.tabs.due,
            count: query.data?.counts?.due,
          },
          {
            value: "paid",
            label: copy.tabs.paid,
            count: query.data?.counts?.paid,
          },
          {
            value: "overdue",
            label: copy.tabs.overdue,
            count: query.data?.counts?.overdue,
          },
        ]}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => {
              setSearch(next)
              resetPage()
            }}
            placeholder={copy.search.placeholder}
            clearLabel={copy.search.clear}
          />
        }
        filter={
          <DataTableFilter
            fields={filterFields}
            value={filters}
            onApply={applyFilters}
            copy={copy.filter}
          />
        }
        actions={
          <>
            <DataTableMenuButton
              label={copy.import.label}
              icon={<Upload className="size-4" aria-hidden />}
              options={[
                { id: "csv", label: copy.import.csv, onSelect: () => {} },
                {
                  id: "template",
                  label: copy.import.template,
                  onSelect: () => {},
                },
              ]}
            />
            <DataTableMenuButton
              label={copy.export.label}
              icon={<Download className="size-4" aria-hidden />}
              options={[
                { id: "csv", label: copy.export.csv, onSelect: () => {} },
                { id: "xlsx", label: copy.export.xlsx, onSelect: () => {} },
              ]}
            />
          </>
        }
      >
        <DataTableActiveFilters
          filters={activeFilters}
          onRemove={(id) => applyFilters(removeFilterValue(filters, id))}
          onClearAll={() => applyFilters({})}
          clearAllLabel={t("filter.clearAll")}
          removeLabel={(f) => t("filter.remove", { label: f.label })}
        />
        {selectedCount > 0 ? (
          <DataTableBulkBar
            selectedLabel={t("bulk.selected", { count: selectedCount })}
            clearLabel={t("bulk.clear")}
            onClear={() => setRowSelection({})}
          >
            <Button type="button" variant="outline" size="sm">
              <Trash2 className="size-4" aria-hidden />
              {t("bulk.delete")}
            </Button>
          </DataTableBulkBar>
        ) : null}
      </DataTableToolbar>

      <DataTable
        table={table}
        isLoading={query.isLoading}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {copy.empty.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {copy.empty.description}
            </p>
          </div>
        }
        renderMobileCard={(row) => {
          const invoice = row.original
          return (
            <DataTableMobileCard
              title={invoice.number}
              subtitle={invoice.customerName}
              badge={
                <Badge variant={STATUS_VARIANT[invoice.status]}>
                  {t(`status.${invoice.status}`)}
                </Badge>
              }
              leading={
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(v) => row.toggleSelected(!!v)}
                  aria-label={t("table.selectRow", { number: invoice.number })}
                />
              }
              selected={row.getIsSelected()}
              fields={[
                { label: t("table.total"), value: money.format(invoice.total) },
                { label: t("table.due"), value: money.format(invoice.due) },
                { label: t("table.dueDate"), value: invoice.dueDate ?? "-" },
              ]}
              actions={
                <DataTableRowActions
                  actions={getActions(invoice)}
                  triggerLabel={t("table.actionsFor", {
                    number: invoice.number,
                  })}
                />
              }
            />
          )
        }}
        footer={
          <DataTablePagination
            {...paginationProps}
            copy={{
              navLabel: t("pagination.nav"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              rowsPerPage: t("pagination.rowsPerPage"),
              summary: ({ from, to, total }) =>
                t("pagination.summary", { from, to, total }),
              pageOf: (page, pageCount) =>
                t("pagination.pageOf", { page, pageCount }),
              pageLabel: (page) => t("pagination.goTo", { page }),
            }}
          />
        }
      />

      <ConfirmDialog
        open={invoiceToDelete !== null}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
        title={t("delete.title")}
        description={t("delete.description", {
          number: invoiceToDelete?.number,
        })}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("delete.cancel")}
        isLoading={deleteInvoice.isPending}
        onConfirm={() => {
          if (!invoiceToDelete) return
          deleteInvoice.mutate(invoiceToDelete.id, {
            onSuccess: () => setInvoiceToDelete(null),
          })
        }}
      />
    </div>
  )
}
