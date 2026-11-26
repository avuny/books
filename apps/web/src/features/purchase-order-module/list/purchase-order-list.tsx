import { useCallback, useMemo, useState } from "react"
import type { ColumnDef, PaginationState } from "@tanstack/react-table"
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import {
  ConfirmDialog,
  DataTable,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewTabs,
  createActionsColumn,
  getTablePaginationProps,
  useDataTable,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { PurchaseOrderStatusBadge } from "../components"
import { formatMinorAmount, usePurchaseOrderLabels } from "../lib"
import {
  useCancelPurchaseOrderMutation,
  useConfirmPurchaseOrderMutation,
  useDeletePurchaseOrderMutation,
  usePurchaseOrderAbilities,
  usePurchaseOrderList,
} from "../purchase-order-api"
import type { PurchaseOrderListItemDto, PurchaseOrderScope } from "../types"

const SCOPES: readonly PurchaseOrderScope[] = ["all", "DRAFT", "CONFIRMED", "CLOSED", "CANCELLED"]

type Props = {
  orgId: string
  onViewOrder: (id: string) => void
  /** Rendered in the toolbar for users who can create (the create form lives in the app shell). */
  createAction?: React.ReactNode
}

type Pending = { kind: "delete" | "confirm" | "cancel"; order: PurchaseOrderListItemDto } | null

export function PurchaseOrderList({ orgId, onViewOrder, createAction }: Props) {
  const { t, i18n } = useTranslation("purchase-order")
  const [scope, setScope] = useState<PurchaseOrderScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [pending, setPending] = useState<Pending>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { orders, total, isLoading } = usePurchaseOrderList(orgId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    scope,
    search,
  })
  const abilities = usePurchaseOrderAbilities(orgId)
  const { getStatusLabel } = usePurchaseOrderLabels()

  const deleteMutation = useDeletePurchaseOrderMutation(orgId)
  const confirmMutation = useConfirmPurchaseOrderMutation(orgId)
  const cancelMutation = useCancelPurchaseOrderMutation(orgId)

  const resetPage = useCallback(() => setPagination((c) => ({ ...c, pageIndex: 0 })), [])

  const getActions = useCallback(
    (item: PurchaseOrderListItemDto): RowAction[] => {
      const actions: RowAction[] = [
        {
          id: "view",
          label: t("actions.view"),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewOrder(item.id),
        },
      ]
      if (item.status === "DRAFT" && abilities.canConfirm) {
        actions.push({
          id: "confirm",
          label: t("actions.confirm"),
          icon: <CheckCircle2 className="size-4 text-primary" />,
          onSelect: () => setPending({ kind: "confirm", order: item }),
        })
      }
      if (["DRAFT", "CONFIRMED"].includes(item.status) && abilities.canCancel) {
        actions.push({
          id: "cancel",
          label: t("actions.cancel"),
          icon: <XCircle className="size-4 text-muted-foreground" />,
          separatorBefore: true,
          onSelect: () => setPending({ kind: "cancel", order: item }),
        })
      }
      if (item.status === "DRAFT" && abilities.canDelete) {
        actions.push({
          id: "delete",
          label: t("actions.delete"),
          icon: <Trash2 className="size-4" />,
          variant: "destructive",
          onSelect: () => setPending({ kind: "delete", order: item }),
        })
      }
      return actions
    },
    [t, onViewOrder, abilities.canConfirm, abilities.canCancel, abilities.canDelete]
  )

  const columns = useMemo<ColumnDef<PurchaseOrderListItemDto>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("table.number"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.number}</span>,
      },
      {
        id: "supplier",
        header: t("table.supplier"),
        enableSorting: false,
        cell: ({ row }) => row.original.partyName ?? "—",
      },
      {
        accessorKey: "orderDate",
        header: t("table.orderDate"),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.orderDate}</span>,
      },
      {
        accessorKey: "expectedDeliveryDate",
        header: t("table.expectedDelivery"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.expectedDeliveryDate ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: t("table.total"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMinorAmount(row.original.totalAmount, row.original.currency, i18n.language)}
          </span>
        ),
      },
      {
        id: "status",
        header: t("table.status"),
        enableSorting: false,
        cell: ({ row }) => (
          <PurchaseOrderStatusBadge
            status={row.original.status}
            label={getStatusLabel(row.original.status)}
          />
        ),
      },
      createActionsColumn<PurchaseOrderListItemDto>({
        headerLabel: t("table.actions"),
        triggerLabel: (item) => t("table.actionsFor", { number: item.number }),
        getActions,
      }),
    ],
    [t, i18n.language, getStatusLabel, getActions]
  )

  const table = useDataTable<PurchaseOrderListItemDto>({
    data: orders,
    columns,
    getRowId: (row) => row.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })
  const paginationProps = getTablePaginationProps(table)

  const run = async (fn: (id: string) => Promise<unknown>) => {
    if (!pending) return
    setActionError(null)
    try {
      await fn(pending.order.id)
      // Step back when the last row of a later page is gone.
      if (pending.kind === "delete" && orders.length === 1 && pagination.pageIndex > 0) {
        setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
      }
      setPending(null)
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const onConfirmPending = () => {
    if (!pending) return
    if (pending.kind === "delete") return run((id) => deleteMutation.mutateAsync({ orgId, id }))
    if (pending.kind === "confirm") return run((id) => confirmMutation.mutateAsync({ orgId, id }))
    return run((id) => cancelMutation.mutateAsync({ orgId, id, data: {} }))
  }

  const dialog = pending
    ? {
        delete: { title: t("actions.deleteTitle"), body: t("actions.deleteDescription"), label: t("actions.delete"), destructive: true },
        confirm: { title: t("actions.confirmTitle"), body: t("actions.confirmDescription"), label: t("actions.confirm"), destructive: false },
        cancel: { title: t("actions.cancelTitle"), body: t("actions.cancelDescription"), label: t("actions.cancel"), destructive: true },
      }[pending.kind]
    : null

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{t("list.title")}</h1>
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
        tabs={SCOPES.map((s) => ({ value: s, label: t(`scopes.${s}`) }))}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => {
              setSearch(next)
              resetPage()
            }}
            placeholder={t("list.searchPlaceholder")}
            clearLabel="Clear"
          />
        }
        actions={abilities.canCreate ? createAction : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(row) => onViewOrder(row.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        }
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

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
            setActionError(null)
          }
        }}
        title={dialog?.title ?? ""}
        description={actionError ?? dialog?.body ?? ""}
        confirmLabel={dialog?.label ?? ""}
        cancelLabel={t("actions.dismiss")}
        destructive={dialog?.destructive}
        isLoading={deleteMutation.isPending || confirmMutation.isPending || cancelMutation.isPending}
        onConfirm={onConfirmPending}
      />
    </div>
  )
}
